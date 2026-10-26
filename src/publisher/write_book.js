const path = require("path");
const { setBookProgress } = require("./write_book_progress");


const { generateResponse, rateBookText, generateImage } = require("./author_speak");

const prompts = require("./prompts");
const bookIO = require("./book_io");
const narrative = require("./narrative");

function enforceInternalValidation() {
    return process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION === "1";
}

function tailParagraph(text) {
    const paragraphs = String(text || "").trim().split(/\n\s*\n/).filter(Boolean);
    return paragraphs.at(-1) || String(text || "").trim() || "No chapter prose available.";
}

function fallbackStoryState(previousState, number, chapterText, warning) {
    const tail = tailParagraph(chapterText).slice(0, 320);
    return {
        version: 1,
        chapters: [
            ...(Array.isArray(previousState?.chapters) ? previousState.chapters : []),
            {
                number,
                ending: tail,
                endingEvidence: tail,
                currentSituation: tail,
                currentSituationEvidence: tail,
                completedEvents: [],
                developments: [],
                resolvedMilestones: [],
                activeMysteries: [],
                chapterProse: String(chapterText || ""),
                extractionFailure: warning,
            },
        ],
    };
}

function parsePositiveInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isInteger(n)) {
        return fallback;
    }
    if (n < min || n > max) {
        return fallback;
    }
    return n;
}

function getGenerationConfig() {
    return {
        duplicateRetries: parsePositiveInt(process.env.BOOKIFY_DUPLICATE_RETRIES, 2, 0, 6),
        storyStateRetries: parsePositiveInt(process.env.BOOKIFY_STORY_STATE_RETRIES, 2, 0, 6),
        shortChapterRetries: parsePositiveInt(process.env.BOOKIFY_SHORT_CHAPTER_RETRIES, 1, 0, 4),
        shortChapterMinWords: parsePositiveInt(process.env.BOOKIFY_SHORT_CHAPTER_MIN_WORDS, 500, 50, 5000),
    };
}

function isLikelyProviderRefusal(text) {
    const value = String(text || "").trim();
    if (!value) {
        return false;
    }
    return /^(?:i'?m sorry|sorry|i cannot|i can\'t|i am unable|i won\'t|i will not)\b/i.test(value);
}

function needsShortChapterRetry(wordCount, minWords) {
    return Number.isFinite(wordCount) && wordCount > 0 && wordCount < minWords;
}

async function buildResponseList(step, authors, prompt, label="Generating response") {
    let responses = [];
    for (let i = 0; i < authors.length; i++) {
        const author = authors[i];
        setBookProgress(step + i + 1, `${label} for ${author.name}`);
        const response = await generateResponse(author.id, prompt);
        responses.push(response);
    }
    return responses;
}


function sanitizeTitle(rawTitle, label = "title") {
    if (typeof rawTitle !== "string") {
        return "";
    }

    let cleaned = rawTitle.trim();
    cleaned = cleaned.replace(/^\s*#+\s*/, "");
    cleaned = cleaned.replace(/^(?:\*\*|__|``` )\s*/, "");
    cleaned = cleaned.replace(/\s*(?:\*\*|__|``` )\s*$/g, "");
    cleaned = cleaned.replace(/^\s*(?:title|book title)\s*[:.-]\s*/i, "");
    cleaned = cleaned.replace(/^\s*(?:chapter|part)\s*\d{1,3}\s*[:.-–—]?\s*/i, "");
    cleaned = cleaned.replace(/^\s*\d+\s*[:.-–—]?\s*/, "");
    cleaned = cleaned.replace(/^\s*["'“”`]+|["'“”`]+\s*$/g, "");
    cleaned = cleaned.replace(/^\s*[-*•]\s*/, "");
    cleaned = cleaned.replace(/^\s+|\s+$/g, "");

    if (!cleaned) {
        return label === "chapter" ? "Untitled Chapter" : "Untitled Book";
    }

    return cleaned;
}

function sanitizeDescription(rawDescription) {
    if (typeof rawDescription !== "string") {
        return "";
    }

    let cleaned = rawDescription.trim();
    cleaned = cleaned.replace(/^\s*(?:description|back-cover description|blurb)\s*[:.-]\s*/i, "");
    cleaned = cleaned.replace(/^\s*#+\s*/, "");
    cleaned = cleaned.replace(/^\s*[-*•]\s*/, "");
    cleaned = cleaned.replace(/^\s*["'“”`]+|["'“”`]+\s*$/g, "");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
    cleaned = cleaned.replace(/^\s+|\s+$/g, "");

    return cleaned || "A story of wonder, courage, and belonging unfolds as the characters face the choices that will change their world forever.";
}

async function writeBook(bookDescription) {
    let step = 0;
    let chapterNames = [];
    let bookName = "";

    const authors = require("../authors/authors.json");

    setBookProgress(++step, "Validating input");
    if (!bookDescription || typeof bookDescription !== "string") {
        throw new Error("prompt must be a non-empty string");
    }
    let prompt = "";
    try {
        prompt = prompts.prompt1Plotline(bookDescription);
        let plotlines = await buildResponseList(step, authors, prompt, "Generating plotline");
        step += authors.length;

        // scores[j] is the total of the ratings author j received from every other author
        let scores = new Array(authors.length).fill(0);
        for(let i = 0; i < authors.length; i++) {
            for(let j = 0; j < authors.length; j++) {
                setBookProgress(++step, `Ranking Plotline: ${authors[i].name} > ${authors[j].name}`);
                if(i == j) continue;
                const ratingPrompt = prompts.prompt2RatePlotline(bookDescription, plotlines[j]);
                const response = await rateBookText(authors[i].id, plotlines[j], ratingPrompt);
                scores[j] += Number(response) || 0;
            }
        }
        const mainPlotlineIndex = scores.indexOf(Math.max(...scores));
        const mainPlotline = plotlines[mainPlotlineIndex];

        // 3 - Generate story bible
        prompt = prompts.prompt3StoryBible(mainPlotline);

        let storyBibles = await buildResponseList(step, authors, prompt, "Generating story bible");
        step += authors.length;

        // 4 - Rate story bibles
        scores = new Array(authors.length).fill(0);
        for(let i = 0; i < authors.length; i++) {
            for(let j = 0; j < authors.length; j++) {
                setBookProgress(++step, `Ranking Story Bible: ${authors[i].name} > ${authors[j].name}`);
                if(i == j) continue;
                const ratingPrompt = prompts.prompt4RateStoryBible(bookDescription, mainPlotline, storyBibles[j]);
                const response = await rateBookText(authors[i].id, storyBibles[j], ratingPrompt);
                scores[j] += Number(response) || 0;
            }
        }
        const mainStoryBibleIndex = scores.indexOf(Math.max(...scores));
        const mainStoryBible = storyBibles[mainStoryBibleIndex];
        const mainAuthor = authors[mainStoryBibleIndex];
        const chapterCount = Number(process.env.CHAPTERS);

        setBookProgress(++step, "Extracting premise commitments");
        const initialCommitmentsRaw = await generateResponse(mainAuthor.id,
            prompts.prompt15ExtractPremiseCommitments(bookDescription, mainPlotline, mainStoryBible), {
                responseFormat: "json_object",
            });
        let premiseCommitments = narrative.parsePremiseCommitments(initialCommitmentsRaw, bookDescription);
        
        // 5 - Generate chapter outline
        prompt = prompts.prompt5WriteChapterOutline(mainPlotline, mainStoryBible, premiseCommitments);
        setBookProgress(++step, "Generating chapter outline");
        const chapterOutline = await generateResponse(mainAuthor.id, prompt);

        /// 6 - Rate chapter outline
        prompt = prompts.prompt6RateChapterOutline(mainPlotline, mainStoryBible, chapterOutline);
        let reviews = [];
        for(let i=0; i < authors.length; i++) {
            if(authors[i].id === mainAuthor.id) continue;
            setBookProgress(++step, `Reviewing Chapter Outline: ${mainAuthor.name} > ${authors[i].name}`);
            const review = await generateResponse(authors[i].id, prompt);
            reviews.push(review);
        }

        // 7 - Revise chapter outline based on reviews
        prompt = prompts.prompt7ImproveChapterOutline(mainStoryBible, chapterOutline, [
            ...reviews,
            `Premise commitments to preserve:\n${JSON.stringify(premiseCommitments, null, 2)}`,
        ]);
        setBookProgress(++step, "Revising chapter outline");
        const outline = await generateResponse(mainAuthor.id, prompt);

        const generationConfig = getGenerationConfig();
        const outlineDiagnostics = {
            initialOutlineParseFailed: false,
            structureWarnings: [],
            premiseWarnings: [],
            repairAttempts: 0,
            usedFallbackPlans: false,
        };
        let approvedOutline = outline;
        let plans = null;
        let outlineParseError = null;
        try {
            plans = narrative.parsePlans(approvedOutline, chapterCount);
        } catch (error) {
            outlineDiagnostics.initialOutlineParseFailed = true;
            outlineParseError = error;
            outlineDiagnostics.structureWarnings.push(`Initial outline parse warning: ${error.message}`);
        }
        if (!plans || outlineParseError) {
            const repairFeedback = [
                ...reviews,
                `Internal structural warning: ${outlineParseError ? outlineParseError.message : "Outline parse failed"}`,
                "Return only valid JSON matching the required schema and chapter count.",
                `Preserve premise commitments:\n${JSON.stringify(premiseCommitments, null, 2)}`,
            ];
            let repairedOutline = approvedOutline;
            for (let attempt = 1; attempt <= 2; attempt++) {
                outlineDiagnostics.repairAttempts++;
                setBookProgress(++step, `Repairing chapter outline (${attempt}/2)`);
                const repairPrompt = prompts.prompt7ImproveChapterOutline(mainStoryBible, repairedOutline, repairFeedback);
                repairedOutline = await generateResponse(mainAuthor.id, repairPrompt, {
                    responseFormat: "json_object",
                });
                try {
                    plans = narrative.parsePlans(repairedOutline, chapterCount);
                    approvedOutline = repairedOutline;
                    break;
                } catch (error) {
                    outlineDiagnostics.structureWarnings.push(`Outline repair attempt ${attempt} warning: ${error.message}`);
                }
            }
        }
        if (!plans) {
            plans = narrative.makeUsablePlans(approvedOutline, chapterCount);
            outlineDiagnostics.usedFallbackPlans = true;
            outlineDiagnostics.structureWarnings.push("Used deterministic fallback plan coercion to preserve chapter coverage.");
        }
        let structureError = null;
        try {
            narrative.validateOutlineStructure(plans);
        } catch (error) {
            structureError = error;
            outlineDiagnostics.structureWarnings.push(`Initial outline structure warning: ${error.message}`);
        }
        if (structureError) {
            let repairedOutline = approvedOutline;
            for (let attempt = 1; attempt <= 2; attempt++) {
                outlineDiagnostics.repairAttempts++;
                setBookProgress(++step, `Repairing outline structure (${attempt}/2)`);
                const repairPrompt = prompts.prompt7ImproveChapterOutline(mainStoryBible, repairedOutline, [
                    ...reviews,
                    `Internal structural warning: ${structureError.message}`,
                    "Repair repeated objectives, setup/payoff gaps, and adjacent overlap while preserving chapter count and schema.",
                    `Preserve premise commitments:\n${JSON.stringify(premiseCommitments, null, 2)}`,
                ]);
                repairedOutline = await generateResponse(mainAuthor.id, repairPrompt, {
                    responseFormat: "json_object",
                });
                let repairedPlans = null;
                try {
                    repairedPlans = narrative.parsePlans(repairedOutline, chapterCount);
                } catch (error) {
                    outlineDiagnostics.structureWarnings.push(`Structure repair parse warning ${attempt}: ${error.message}`);
                    continue;
                }
                try {
                    narrative.validateOutlineStructure(repairedPlans);
                    plans = repairedPlans;
                    approvedOutline = repairedOutline;
                    structureError = null;
                    break;
                } catch (error) {
                    structureError = error;
                    outlineDiagnostics.structureWarnings.push(`Structure repair warning ${attempt}: ${error.message}`);
                }
            }
        }
        if (structureError) {
            const warning = `Non-blocking outline validation warning: ${structureError.message}`;
            outlineDiagnostics.structureWarnings.push(warning);
            console.warn(warning);
            if (enforceInternalValidation()) {
                console.warn("BOOKIFY_ENFORCE_INTERNAL_VALIDATION is set, but completion-first mode continues with usable outline plans.");
            }
        }

        setBookProgress(++step, "Refreshing premise commitments");
        const refreshedCommitmentsRaw = await generateResponse(mainAuthor.id,
            prompts.prompt15ExtractPremiseCommitments(bookDescription, mainPlotline, mainStoryBible, approvedOutline), {
                responseFormat: "json_object",
            });
        premiseCommitments = narrative.parsePremiseCommitments(refreshedCommitmentsRaw, bookDescription);

        let premiseCoverageError = null;
        try {
            narrative.validatePremiseCoverage(plans, premiseCommitments);
        } catch (error) {
            premiseCoverageError = error;
            outlineDiagnostics.premiseWarnings.push(`Initial premise coverage warning: ${error.message}`);
        }
        if (premiseCoverageError) {
            let repairedOutline = approvedOutline;
            for (let attempt = 1; attempt <= 2; attempt++) {
                outlineDiagnostics.repairAttempts++;
                setBookProgress(++step, `Repairing premise coverage (${attempt}/2)`);
                const repairPrompt = prompts.prompt7ImproveChapterOutline(mainStoryBible, repairedOutline, [
                    ...reviews,
                    `Internal premise coverage warning: ${premiseCoverageError.message}`,
                    `Premise commitments that must be fulfilled:\n${JSON.stringify(premiseCommitments, null, 2)}`,
                    "Repair missing premise promises, mechanism logic, reveal timing, and ending payoffs while preserving chapter count and schema.",
                ]);
                repairedOutline = await generateResponse(mainAuthor.id, repairPrompt, {
                    responseFormat: "json_object",
                });
                let repairedPlans = null;
                try {
                    repairedPlans = narrative.parsePlans(repairedOutline, chapterCount);
                } catch (error) {
                    outlineDiagnostics.premiseWarnings.push(`Premise repair parse warning ${attempt}: ${error.message}`);
                    continue;
                }
                try {
                    narrative.validatePremiseCoverage(repairedPlans, premiseCommitments);
                    plans = repairedPlans;
                    approvedOutline = repairedOutline;
                    premiseCoverageError = null;
                    break;
                } catch (error) {
                    premiseCoverageError = error;
                    outlineDiagnostics.premiseWarnings.push(`Premise repair warning ${attempt}: ${error.message}`);
                }
            }
        }
        if (premiseCoverageError) {
            const warning = `Non-blocking premise coverage warning: ${premiseCoverageError.message}`;
            outlineDiagnostics.premiseWarnings.push(warning);
            console.warn(warning);
        }
        // Freeze the approved plan for the entire manuscript. No later outline rewriting.
        const UUID = bookIO.makeBookFolder();
        bookIO.setOriginalDescription(UUID, bookDescription);
        bookIO.setBookDescription(UUID, bookDescription);
        bookIO.setStoryBible(UUID, mainStoryBible);
        bookIO.setChapterOutline(UUID, approvedOutline);

        // 8 - Generate chapters
        let chapters = [];
        let state = {version:1, chapters:[]};
        for (let i=0; i<chapterCount; i++) {
            const number = i + 1;
            const previousChapter = chapters[i-1] || "";
            const context = narrative.contextFor(plans, number, state, previousChapter, premiseCommitments);
            const plan = context.currentPlan;
            if (Number(plan.number) !== number) {
                throw new Error(`Chapter ${number} selected plan ${plan?.number ?? 'unknown'} instead of the correct chapter plan.`);
            }
            const writePrompt = prompts.prompt8WriteChapterX(mainStoryBible, plan, number,
                context.previousChapter, JSON.stringify(context.storyHistory), undefined, undefined, context);
            const debugEntry = {
                requestedChapterNumber:number, selectedPlanNumber:plan.number,
                requiredEventCount:plan.requiredEvents.length,
                previousChapterNumber:context.previousChapterNumber,
                previousChapterContextLength:context.previousChapter.length,
                storyStateContextLength:JSON.stringify(context.storyHistory).length,
                chapterWordCount:null, cacheHit:null, similarityToEarlierChapters:[], saved:false,
                generationAttempts:0,
                duplicateRetryCount:0,
                shortChapterRetryCount:0,
                memoryExtractionAttempts:0,
                memoryFallbackUsed:false,
                memoryExtractionSucceeded:false,
                acceptedWarnings:[],
            };
            let chapter, cleanChapterName, validState, stage = 'generation';
            try {
                const maxAttempts = 1 + generationConfig.duplicateRetries + generationConfig.shortChapterRetries;
                let duplicateRetriesUsed = 0;
                let shortRetriesUsed = 0;
                let acceptedDuplicate = null;
                let acceptedShortChapter = false;
                let lastNonEmptyChapter = null;
                let lastNonEmptyComparisons = [];
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    debugEntry.generationAttempts = attempt;
                    const attemptLabel = attempt > 1 ? ` (attempt ${attempt}/${maxAttempts})` : "";
                    setBookProgress(++step, `Chapter ${number} - Generating${attemptLabel}`);
                    const candidate = await generateResponse(mainAuthor.id, writePrompt, {
                        onCacheMetadata: meta => { debugEntry.cacheHit = meta.hit; },
                    });
                    if (isLikelyProviderRefusal(candidate)) {
                        throw new Error(`Chapter ${number} generation refusal: provider declined required content`);
                    }
                    const candidateWords = candidate.trim() ? candidate.trim().split(/\s+/).length : 0;
                    if (!candidateWords) {
                        if (attempt === maxAttempts) {
                            throw new Error(`Chapter ${number} returned empty prose`);
                        }
                        continue;
                    }
                    lastNonEmptyChapter = candidate;
                    const comparisons = narrative.comparePreviousChapters(candidate,
                        chapters.map((text,index)=>({number:index+1,text})));
                    lastNonEmptyComparisons = comparisons;
                    const duplicate = comparisons.find(c=>c.reason);
                    const shortChapter = needsShortChapterRetry(candidateWords, generationConfig.shortChapterMinWords);
                    if (duplicate && duplicateRetriesUsed < generationConfig.duplicateRetries) {
                        duplicateRetriesUsed++;
                        debugEntry.duplicateRetryCount = duplicateRetriesUsed;
                        continue;
                    }
                    if (shortChapter && shortRetriesUsed < generationConfig.shortChapterRetries) {
                        shortRetriesUsed++;
                        debugEntry.shortChapterRetryCount = shortRetriesUsed;
                        continue;
                    }
                    chapter = candidate;
                    debugEntry.chapterWordCount = candidateWords;
                    acceptedDuplicate = duplicate || null;
                    acceptedShortChapter = shortChapter;
                    break;
                }
                if (!chapter) {
                    if (!lastNonEmptyChapter) {
                        throw new Error(`Chapter ${number} generation failed to produce usable prose`);
                    }
                    chapter = lastNonEmptyChapter;
                    debugEntry.chapterWordCount = chapter.trim().split(/\s+/).length;
                    acceptedDuplicate = lastNonEmptyComparisons.find(c=>c.reason) || null;
                }
                stage = 'duplicate check';
                const comparisons = lastNonEmptyComparisons.length
                    ? lastNonEmptyComparisons
                    : narrative.comparePreviousChapters(chapter,
                        chapters.map((text,index)=>({number:index+1,text})));
                debugEntry.similarityToEarlierChapters = comparisons.length
                    ? Math.max(...comparisons.map(c => Number(c.similarity) || 0))
                    : 0;
                debugEntry.similarityDetails = comparisons;
                if (acceptedDuplicate) {
                    const duplicateMessage = `Duplicate chapter accepted after retries: Chapter ${number} resembles Chapter ${acceptedDuplicate.chapterNumber}; similarity ${(acceptedDuplicate.similarity*100).toFixed(1)}%, copied coverage ${(Math.max(acceptedDuplicate.currentCoverage,acceptedDuplicate.previousCoverage)*100).toFixed(1)}%, longest copied passage ${acceptedDuplicate.copiedWords} words (${acceptedDuplicate.reason}).`;
                    debugEntry.duplicateWarning = duplicateMessage;
                    debugEntry.acceptedWarnings.push(duplicateMessage);
                    console.warn(`Non-blocking duplicate warning: ${duplicateMessage}`);
                }
                if (acceptedShortChapter) {
                    const shortWarning = `Short chapter accepted: Chapter ${number} has ${debugEntry.chapterWordCount} words (target minimum ${generationConfig.shortChapterMinWords}).`;
                    debugEntry.shortChapterWarning = shortWarning;
                    debugEntry.acceptedWarnings.push(shortWarning);
                    console.warn(`Non-blocking short chapter warning: ${shortWarning}`);
                }
                setBookProgress(++step, `Chapter ${number} - Extracting story memory`);
                stage = 'memory extraction';
                const extractionWarnings = [];
                for (let extractionAttempt = 1; extractionAttempt <= 1 + generationConfig.storyStateRetries; extractionAttempt++) {
                    debugEntry.memoryExtractionAttempts = extractionAttempt;
                    try {
                        const extracted = await generateResponse(mainAuthor.id, narrative.storyStatePrompt(number,chapter), {
                            responseFormat: "json_object",
                        });
                        validState = narrative.buildStoryStateEntry({number,chapterText:chapter,extracted,previousState:state});
                        debugEntry.memoryExtractionSucceeded = true;
                        break;
                    } catch (error) {
                        extractionWarnings.push(`attempt ${extractionAttempt}: ${error.message}`);
                        if (extractionAttempt < 1 + generationConfig.storyStateRetries) {
                            continue;
                        }
                    }
                }
                if (!validState) {
                    const warning = `Story-state extraction warning at chapter ${number}: ${extractionWarnings.join(' | ')}`;
                    validState = fallbackStoryState(state, number, chapter, warning);
                    debugEntry.storyStateWarning = warning;
                    debugEntry.memoryFallbackUsed = true;
                    debugEntry.acceptedWarnings.push(warning);
                    console.warn(`Non-blocking story-state warning: ${warning}`);
                }
                setBookProgress(++step, `Chapter ${number} - Generating title`);
                stage = 'title';
                cleanChapterName = sanitizeTitle(await generateResponse(mainAuthor.id,
                    prompts.prompt11WriteChapterName(mainStoryBible,plan,number,chapter,chapterNames)), 'chapter');
                stage = 'save';
                bookIO.addChapter(UUID,number,cleanChapterName,chapter,validState,undefined,{
                    generationAttempts: debugEntry.generationAttempts,
                    duplicateRetryCount: debugEntry.duplicateRetryCount,
                    shortChapterRetryCount: debugEntry.shortChapterRetryCount,
                    memoryExtractionAttempts: debugEntry.memoryExtractionAttempts,
                    memoryExtractionSucceeded: debugEntry.memoryExtractionSucceeded,
                    memoryFallbackUsed: debugEntry.memoryFallbackUsed,
                    acceptedWarnings: debugEntry.acceptedWarnings,
                    chapterWordCount: debugEntry.chapterWordCount,
                });
                debugEntry.acceptedWithWarning = debugEntry.acceptedWarnings.length > 0;
                debugEntry.saved = true;
            } catch (error) {
                // Log metadata only, never complete prose, prompts or API error bodies.
                debugEntry.failureStage = stage;
                throw error;
            } finally {
                console.log('[chapter-debug] ' + JSON.stringify(debugEntry));
            }
            state = validState;
            chapters.push(chapter);
            chapterNames.push(cleanChapterName);
        }

        prompt = prompts.prompt12WriteBookName(mainStoryBible, approvedOutline);
        setBookProgress(++step, "Generating book name");
        const rawBookName = await generateResponse(mainAuthor.id, prompt);
        bookName = sanitizeTitle(rawBookName, "book");

        prompt = prompts.prompt14WriteBookDescription(mainStoryBible, approvedOutline, bookName, chapterNames);
        setBookProgress(++step, "Generating back-cover description");
        const rawBookDescription = await generateResponse(mainAuthor.id, prompt);
        const cleanedBookDescription = sanitizeDescription(rawBookDescription);
        bookIO.setDescription(UUID, cleanedBookDescription);
        
        bookIO.setTitle(UUID, bookName);
        bookIO.setAuthor(UUID, mainAuthor.name);
        if (outlineDiagnostics.structureWarnings.length || outlineDiagnostics.premiseWarnings.length || outlineDiagnostics.repairAttempts || outlineDiagnostics.usedFallbackPlans) {
            bookIO.setPipelineDiagnostics(UUID, {
                outline: outlineDiagnostics,
                premiseCommitments,
            });
        }
        bookIO.writeFullBook(UUID);

        const coverBible = mainStoryBible.length > 3500
            ? `${mainStoryBible.slice(0, 3500).trim()}\n...[TRUNCATED for cover prompt length limits]`
            : mainStoryBible;

        const coverChapters = chapters.slice(0, 5).map((chapter, index) => {
            const maxChars = 500;
            const excerpt = chapter.length > maxChars ? `${chapter.slice(0, maxChars).trim()}...` : chapter;
            return `Chapter ${index + 1} excerpt:\n${excerpt}`;
        });

        prompt = prompts.prompt13MakeBookCover(coverBible, bookName, mainAuthor.name, coverChapters);
        setBookProgress(++step, "Generating book cover image");
        try {
            const coverImagePath = path.join(__dirname, "..", "books", UUID, "cover.png");
            const coverImageBuffer = await generateImage(mainAuthor.id, prompt, coverImagePath);
            bookIO.setCoverImage(UUID, "cover.png");
            if (!coverImageBuffer || !Buffer.isBuffer(coverImageBuffer)) {
                throw new Error("Image generation returned no PNG data");
            }
        } catch (coverError) {
            const reason = coverError && coverError.message ? coverError.message : String(coverError);
            setBookProgress(++step, `Cover image skipped: ${reason}`);
            console.log(`Cover image generation failed: ${reason}`);
            bookIO.setCoverImage(UUID, "");
        }
        

    } catch (error) {
        throw new Error(`Failed to generate book: ${error.message}`);
    }

    

    return {
        message: "Book pipeline finished",
        bookName,
        chapterNames,
    };
}

module.exports = {
  writeBook,
  sanitizeTitle,
};
