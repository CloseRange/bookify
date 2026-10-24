const { setBookProgress } = require("./write_book_progress");

const { generateResponse, rateBookText, generateImage } = require("./author_speak");

const prompts = require("./prompts");
const bookIO = require("./book_io");

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
        const chapterCount = process.env.CHAPTERS ? parseInt(process.env.CHAPTERS) : 10;
        
        // 5 - Generate chapter outline
        prompt = prompts.prompt5WriteChapterOutline(mainPlotline, mainStoryBible);
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
        prompt = prompts.prompt7ImproveChapterOutline(mainStoryBible, chapterOutline, reviews);
        setBookProgress(++step, "Revising chapter outline");
        const outline = await generateResponse(mainAuthor.id, prompt);

        const UUID = bookIO.makeBookFolder();

        // 8 - Generate chapters
        const minPages = process.env.MIN_PAGES_PER_CHAPTER ? parseInt(process.env.MIN_PAGES_PER_CHAPTER) : 5;
        const maxPages = process.env.MAX_PAGES_PER_CHAPTER ? parseInt(process.env.MAX_PAGES_PER_CHAPTER) : 10;
        let chapters = [];
        for(let i=0; i < chapterCount; i++) {
            // 8 - Generate chapter
            setBookProgress(++step, `Chapter ${i+1} of ${chapterCount} - Generating chapter ${i+1}`);
            const lastChapter = chapters[i-1] || "";
            prompt = prompts.prompt8WriteChapterX(mainStoryBible, outline, i + 1, lastChapter, minPages, maxPages);
            const chapterDraft = await generateResponse(mainAuthor.id, prompt);

            prompt = prompts.prompt9ReviewChapterX(mainStoryBible, outline, i + 1, chapterDraft);
            let chapterReviews = [];
            for(let j=0; j < authors.length; j++) {
                if(authors[j].id === mainAuthor.id) continue;
                setBookProgress(++step, `Chapter ${i+1} of ${chapterCount} - Reviewing chapter ${i+1}: ${mainAuthor.name} > ${authors[j].name}`);
                const review = await generateResponse(authors[j].id, prompt);
                chapterReviews.push(review);
            }
            
            prompt = prompts.prompt10ImproveChapterX(mainStoryBible, outline, i + 1, chapterDraft, chapterReviews);
            setBookProgress(++step, `Chapter ${i+1} of ${chapterCount} - Revising chapter ${i+1}`);
            const revisedChapter = await generateResponse(mainAuthor.id, prompt);
            
            chapters.push(revisedChapter);
            prompt = prompts.prompt11WriteChapterName(mainStoryBible, outline, i + 1, revisedChapter);
            setBookProgress(++step, `Chapter ${i+1} of ${chapterCount} - Generating chapter name`);
            const chapterName = await generateResponse(mainAuthor.id, prompt);
            chapterNames.push(chapterName);

            bookIO.addChapter(UUID, i + 1, chapterName, revisedChapter);
        }

        prompt = prompts.prompt12WriteBookName(mainStoryBible, outline);
        setBookProgress(++step, "Generating book name");
        bookName = await generateResponse(mainAuthor.id, prompt);
        
        bookIO.setTitle(UUID, bookName);
        bookIO.setAuthor(UUID, mainAuthor.name);

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
        const coverImageBuffer = await generateImage(mainAuthor.id, prompt);
        bookIO.saveCoverImage(UUID, coverImageBuffer, "cover.png");
        

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
};
