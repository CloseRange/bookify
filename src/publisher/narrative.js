// Model judgments are untrusted data: acceptance is derived here, never from a score.
const text = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(text);
function normalizeEvidence(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/```(?:[a-z]+)?/gi, ' ')
    .replace(/[“”‘’]/g, '"')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function hasEvidence(chapter, evidence) {
  const chapterText = normalizeEvidence(chapter);
  const evidenceText = normalizeEvidence(evidence);
  return Boolean(evidenceText && chapterText.includes(evidenceText));
}
function normalizeStatus(status) {
  if (!text(String(status ?? ''))) return '';
  const value = String(status).trim().toLowerCase();
  const map = {
    dramatized: 'dramatized',
    covered: 'dramatized',
    present: 'dramatized',
    fulfilled: 'dramatized',
    met: 'dramatized',
    missing: 'missing',
    absent: 'missing',
    omitted: 'missing',
    contradicted: 'contradicted',
    contradiction: 'contradicted',
    conflict: 'contradicted',
    summarized: 'summarized',
    summary: 'summarized',
    implied: 'summarized',
  };
  return map[value] || '';
}
function normalizeEvents(events, expectedCount) {
  const enriched = events.map((entry, position) => {
    const parsed = Number(entry?.index);
    return {
      ...entry,
      _position: position,
      _index: Number.isInteger(parsed) ? parsed : position,
      status: normalizeStatus(entry?.status),
    };
  });

  const raw = enriched.map(e => e._index);
  const zeroBased = raw.every(i => i >= 0 && i < expectedCount);
  const oneBased = raw.every(i => i >= 1 && i <= expectedCount);

  if (zeroBased || oneBased) {
    const adjusted = enriched.map(e => ({
      ...e,
      _index: oneBased ? e._index - 1 : e._index,
    }));
    const unique = new Set(adjusted.map(e => e._index));
    if (unique.size === expectedCount) {
      return adjusted
        .sort((a, b) => a._index - b._index)
        .map((e, index) => ({ ...e, index }));
    }
  }

  // Fallback to declared order when indexes are malformed or duplicated.
  return enriched.map((e, index) => ({ ...e, index }));
}
function extractLikelyJsonObject(text) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return text;
  return text.slice(first, last + 1);
}
function repairLooseJson(text) {
  return text
    .replace(/```(?:json)?/gi, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}
function json(raw) {
  if (typeof raw !== 'string') return raw;
  const cleaned = raw.trim();
  const candidates = [
    cleaned,
    repairLooseJson(cleaned),
    extractLikelyJsonObject(cleaned),
    repairLooseJson(extractLikelyJsonObject(cleaned)),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      // Keep trying progressively more forgiving variants.
    }
  }
  throw new Error('Malformed JSON in model response');
}
const PLAN_FORMAT = `Return only JSON: {"chapters":[{"number":1,"purpose":"distinct narrative purpose","start":"opening conditions, POV, tense, location and chronology","requiredEvents":["concrete observable scene, characters, action and consequence in planned sequence"],"ending":"required ending conditions","introductions":["new character names"],"optionalDetails":["creative suggestions"]}]}. Use every field. Required events must be dramatized, causally follow previous chapters, and add new information or consequences. Separate optional details from mandatory events. Explicitly complete the main conflict in its assigned climax chapter: state how it is resolved, never merely imply a possible victory. Preserve setups, payoffs, knowledge boundaries and cumulative character growth.`;
function normalizeComparableText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/```(?:[a-z]+)?/gi, ' ')
    .replace(/[_*`#>\-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function normalizeThreadKey(value) {
  return normalizeComparableText(value).slice(0, 220);
}
function compactString(value, fallback = '') {
  const textValue = String(value ?? '').trim();
  return textValue || fallback;
}
function compactStringArray(value, maxItems = 32) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => compactString(item, ''))
    .filter(Boolean)
    .slice(0, maxItems);
}
function compactObjectArray(value, mapper, maxItems = 32) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const mapped = mapper(item);
    if (mapped) out.push(mapped);
    if (out.length >= maxItems) break;
  }
  return out;
}
const OUTLINE_STOPWORDS = new Set([
  'about','after','again','against','along','already','also','although','among','around','before','being','between','because',
  'beyond','chapter','character','characters','choice','decides','during','every','facing','first','final','following','further',
  'hidden','inside','into','later','learns','major','makes','meaning','moment','other','their','there','these','those','through',
  'toward','under','using','while','within','without','would','where','which','whose','until','still','scene','scenes','story',
  'team','they','them','this','that','with','from','into','what','when','have','been','will','your','only','over','across'
]);
function significantOutlineTerms(value) {
  return normalizeComparableText(value)
    .split(/\s+/)
    .filter(Boolean)
    .filter(term => term.length >= 5)
    .filter(term => !OUTLINE_STOPWORDS.has(term));
}
function capitalizedNames(value) {
  return [...String(value ?? '').matchAll(/\b[A-Z][a-z]{2,}\b/g)]
    .map(match => match[0].toLowerCase())
    .filter(name => !['chapter'].includes(name));
}
function parsePlans(raw, count) {
  const result = json(raw);
  if (!Array.isArray(result?.chapters) || result.chapters.length !== count) throw new Error('Outline must contain exactly the configured chapter count');
  result.chapters.forEach((p, i) => {
    if (p.number !== i + 1 || !text(p.purpose) || !text(p.start) || !text(p.ending) || !strings(p.requiredEvents) || !p.requiredEvents.length || !strings(p.introductions) || !strings(p.optionalDetails)) throw new Error(`Invalid approved plan for chapter ${i + 1}`);
  });
  return Object.freeze(result.chapters.map(p => Object.freeze({...p, requiredEvents:Object.freeze([...p.requiredEvents]), introductions:Object.freeze([...p.introductions]), optionalDetails:Object.freeze([...p.optionalDetails])})));
}
function freezePlans(plans) {
  return Object.freeze(plans.map(p => Object.freeze({
    ...p,
    requiredEvents: Object.freeze([...p.requiredEvents]),
    introductions: Object.freeze([...p.introductions]),
    optionalDetails: Object.freeze([...p.optionalDetails]),
  })));
}
function toCleanString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  return cleaned || fallback;
}
function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => toCleanString(item, ''))
    .filter(Boolean);
}
function fallbackPlan(number, count) {
  const nextLabel = number >= count ? 'the book ending' : `chapter ${number + 1}`;
  return {
    number,
    purpose: `Advance the core conflict through a distinct development in chapter ${number}`,
    start: 'Continue naturally from the accepted previous chapter ending and established canon.',
    requiredEvents: [`Deliver at least one concrete event in chapter ${number} that changes the situation before ${nextLabel}.`],
    ending: `Close chapter ${number} with a concrete consequence that enables ${nextLabel}.`,
    introductions: [],
    optionalDetails: ['Avoid repeating previous chapter scenes or discoveries unless there is a clear new consequence.'],
  };
}
function coercePlanShape(candidate, number, count) {
  const fallback = fallbackPlan(number, count);
  if (!candidate || typeof candidate !== 'object') {
    return fallback;
  }
  const requiredEvents = toStringArray(candidate.requiredEvents);
  const optionalDetails = toStringArray(candidate.optionalDetails);
  return {
    number,
    purpose: toCleanString(candidate.purpose, fallback.purpose),
    start: toCleanString(candidate.start, fallback.start),
    requiredEvents: requiredEvents.length ? requiredEvents : fallback.requiredEvents,
    ending: toCleanString(candidate.ending, fallback.ending),
    introductions: toStringArray(candidate.introductions),
    optionalDetails: optionalDetails.length ? optionalDetails : fallback.optionalDetails,
  };
}
function makeUsablePlans(raw, count) {
  const chapterCount = Number(count);
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error('Chapter count must be a positive integer');
  }
  let parsed;
  try {
    parsed = json(raw);
  } catch (_error) {
    parsed = { chapters: [] };
  }
  const source = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  const byNumber = new Map();
  for (const entry of source) {
    const n = Number(entry?.number);
    if (Number.isInteger(n) && n >= 1 && n <= chapterCount && !byNumber.has(n)) {
      byNumber.set(n, entry);
    }
  }
  const plans = [];
  for (let i = 1; i <= chapterCount; i++) {
    const candidate = byNumber.get(i) || source[i - 1];
    plans.push(coercePlanShape(candidate, i, chapterCount));
  }
  return freezePlans(plans);
}
function outlineSimilarity(left, right) {
  const normalize = value => normalizeComparableText(value)
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => word.length > 2)
    .filter(word => !['with','from','into','that','this','they','them','have','been','will','what','when','where','your','their','there','these','those','only','over','under','after','before','about','through','across','around'].includes(word));
  const a = normalize(left);
  const b = normalize(right);
  if (!a.length || !b.length) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const shared = [...aSet].filter(word => bSet.has(word)).length;
  const maxTerms = Math.max(aSet.size, bSet.size);
  return maxTerms ? shared / maxTerms : 0;
}
function validateOutlineStructure(chapters) {
  if (!Array.isArray(chapters) || !chapters.length) {
    throw new Error('Outline must include at least one approved chapter');
  }
  const problems = [];
  for (let i = 1; i < chapters.length; i++) {
    const previous = chapters[i - 1];
    const current = chapters[i];
    const structuralOverlap = [previous.purpose, ...previous.requiredEvents].join(' ');
    const newStructuralOverlap = [current.purpose, ...current.requiredEvents].join(' ');
    if (outlineSimilarity(structuralOverlap, newStructuralOverlap) >= 0.5) {
      problems.push(`Repeated chapter objectives between chapters ${previous.number} and ${current.number}: both chapters are built around the same core action and should be revised before writing.`);
    }

    const setupTerms = /(reveal|expose|betray|confess|sacrifice|admit|escape|confront|defeat|resolve|unmask|marry|sever|announce|accept|disclose|recover|truth|secret|pact|lie|promise)/i;
    const setupSignals = ['secret','truth','pact','betrayal','confession','sacrifice','revelation','lie','promise','alliance','betray'];
    const setupCueTerms = /(mystery|secret|hidden|unknown|clue|hint|rumor|risk|danger|cost|past|history|heritage|identity|memory|question|doubt)/i;
    for (const event of current.requiredEvents) {
      if (!setupTerms.test(event)) {
        continue;
      }
      const eventText = normalizeComparableText(event);
      const earlierText = chapters.slice(0, i).map(chapter => [chapter.purpose, chapter.start, ...chapter.requiredEvents, ...chapter.introductions].join(' ')).join(' ');
      const matchingSignals = setupSignals.filter(signal => eventText.includes(signal));
      const normalizedEarlier = normalizeComparableText(earlierText);
      const hasSignalSetup = matchingSignals.some(signal => normalizedEarlier.includes(signal));
      const eventTerms = significantOutlineTerms(eventText);
      const earlierTerms = new Set(significantOutlineTerms(earlierText));
      const overlappingTerms = eventTerms.filter(term => earlierTerms.has(term));
      const hasTermSetup = overlappingTerms.length >= 2;
      const namedAnchors = capitalizedNames(event);
      const hasNamedAnchorSetup = namedAnchors.some(name => normalizedEarlier.includes(name)) && setupCueTerms.test(earlierText);
      const hasSetup = hasSignalSetup || hasTermSetup || hasNamedAnchorSetup;
      if (i > 0 && matchingSignals.length > 0 && !hasSetup) {
        problems.push(`Missing setup before chapter ${current.number}: "${event}" introduces a major payoff without earlier context to support it.`);
      }
    }
  }
  if (problems.length) {
    throw new Error(problems.join(' | '));
  }
  return chapters;
}
function parsePremiseCommitments(raw, description = '') {
  let parsed;
  try {
    parsed = json(raw);
  } catch (_error) {
    parsed = {};
  }
  const fallbackPromise = compactString(description, 'Deliver the core premise promised in the original description.').slice(0, 280);
  const promises = compactStringArray(parsed?.essentialPlotPromises, 20);
  const endingPayoffs = compactStringArray(parsed?.requiredEndingPayoffs, 20);
  return {
    essentialPlotPromises: promises.length ? promises : [fallbackPromise],
    centralMystery: compactString(parsed?.centralMystery, compactString(description, 'Resolve the manuscript\'s central mystery.')),
    majorReveals: compactObjectArray(parsed?.majorReveals, item => {
      const reveal = compactString(item?.reveal, '');
      if (!reveal) return null;
      const phase = compactString(item?.expectedPhase, 'middle').toLowerCase();
      const allowedPhases = new Set(['setup', 'middle', 'climax', 'ending']);
      return {
        reveal,
        expectedPhase: allowedPhases.has(phase) ? phase : 'middle',
        whyItMatters: compactString(item?.whyItMatters, 'Supports premise fulfillment and ending payoff.'),
      };
    }, 24),
    causalRules: compactStringArray(parsed?.causalRules, 30),
    requiredEndingPayoffs: endingPayoffs.length ? endingPayoffs : compactStringArray(promises, 8),
  };
}
function containsOutlineSignal(textBlock, signal) {
  const source = normalizeComparableText(textBlock);
  const signalWords = normalizeComparableText(signal)
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => word.length >= 4)
    .filter(word => !OUTLINE_STOPWORDS.has(word))
    .slice(0, 8);
  if (!signalWords.length) return false;
  const matched = signalWords.filter(word => source.includes(word));
  return matched.length >= Math.min(2, signalWords.length);
}
function validatePremiseCoverage(chapters, commitments) {
  if (!commitments || typeof commitments !== 'object') return chapters;
  if (!Array.isArray(chapters) || !chapters.length) return chapters;
  const fullOutlineText = chapters.map(ch => [ch.purpose, ch.start, ...(ch.requiredEvents || []), ch.ending].join(' ')).join(' ');
  const endingText = chapters.slice(Math.max(0, chapters.length - 2)).map(ch => [ch.purpose, ...(ch.requiredEvents || []), ch.ending].join(' ')).join(' ');
  const missingPromises = (commitments.essentialPlotPromises || []).filter(item => !containsOutlineSignal(fullOutlineText, item));
  const missingEndingPayoffs = (commitments.requiredEndingPayoffs || []).filter(item => !containsOutlineSignal(endingText, item));
  const missingMystery = commitments.centralMystery && !containsOutlineSignal(fullOutlineText, commitments.centralMystery);
  const problems = [];
  if (missingPromises.length) {
    problems.push(`Missing core premise coverage: ${missingPromises.join(' ; ')}`);
  }
  if (missingMystery) {
    problems.push(`Missing central mystery progression: ${commitments.centralMystery}`);
  }
  if (missingEndingPayoffs.length) {
    problems.push(`Missing ending payoffs: ${missingEndingPayoffs.join(' ; ')}`);
  }
  if (problems.length) {
    throw new Error(problems.join(' | '));
  }
  return chapters;
}
function collectThreadState(history = []) {
  const completedMilestones = new Set();
  const activeMysteries = new Map();
  for (const chapter of history) {
    for (const milestone of chapter?.resolvedMilestones || []) {
      if (!text(milestone?.item)) continue;
      const status = String(milestone.status || '').toLowerCase();
      if (['advanced', 'completed', 'resolved'].includes(status)) {
        completedMilestones.add(milestone.item.trim());
      }
    }
    for (const mystery of chapter?.activeMysteries || []) {
      if (!text(mystery?.question)) continue;
      const key = normalizeThreadKey(mystery.question);
      const state = String(mystery.state || 'open').toLowerCase();
      if (state === 'resolved') {
        activeMysteries.delete(key);
      } else {
        activeMysteries.set(key, {
          question: mystery.question.trim(),
          state: ['open', 'partially answered'].includes(state) ? state : 'open',
          evidence: compactString(mystery.evidence, ''),
        });
      }
    }
  }
  return {
    completedMilestones: [...completedMilestones],
    activeMysteries: [...activeMysteries.values()],
  };
}
function contextFor(plans, number, state, previousChapter, premiseCommitments) {
  if (!Array.isArray(plans)) throw new Error('Approved chapter plans must be an array');
  const requested = Number(number);
  if (!Number.isInteger(requested) || requested < 1) throw new Error("Invalid requested chapter number");
  const currentPlan = plans[requested - 1];
  if (!currentPlan) throw new Error(`Missing approved plan for chapter ${requested}`);
  if (Number(currentPlan.number) !== requested) throw new Error(`Requested chapter ${requested} selected plan ${currentPlan.number ?? 'unknown'}`);
  const history = Array.isArray(state?.chapters) ? state.chapters : [];
  if (history.length !== requested - 1 || history.some((entry, i) => entry.number !== i + 1)) throw new Error(`Story history is not sequential before chapter ${requested}`);
  if (requested > 1 && !text(previousChapter)) throw new Error(`Missing previous prose for chapter ${requested}`);
  return {
    requestedChapterNumber: requested,
    currentPlan,
    futureMilestones: plans.slice(requested).map(p => ({number: Number(p.number), requiredEvents: p.requiredEvents, ending: p.ending, introductions: p.introductions})),
    state: { version: 1, chapters: history },
    previousChapter: previousChapter || '',
    previousChapterNumber: history.length ? Number(history.at(-1)?.number) || null : null,
    premiseCommitments: premiseCommitments || null,
    ...collectThreadState(history),
    storyHistory: history.map(entry => ({number:entry.number, ending:entry.ending,
      currentSituation:entry.currentSituation,
      completedEvents:(entry.completedEvents || []).map(e=>({description:e.description})),
      developments:(entry.developments || []).map(({category,subject,fact})=>({category,subject,fact})),
      resolvedMilestones:(entry.resolvedMilestones || []).map(({item,status})=>({item,status})),
      activeMysteries:(entry.activeMysteries || []).map(({question,state})=>({question,state})),
    })),
  };
}
const STATE_CATEGORIES = new Set(['locations','relationships','knowledge','abilities','events','conflicts','consequences','timeline','breakthroughs','items','promises','situation','decisions']);
function storyStatePrompt(number, chapter) {
  return `Extract story state from the final prose of Chapter ${number}. Do not review, rewrite, rate or improve it. Use ONLY actual events in this prose, never an outline or assumed future events. Distinguish thoughts, dreams, speculation and intentions from real occurrences; do not promote them to facts. Record concise completed events, current situation, locations, discoveries and character knowledge, relationship changes, abilities and limitations, lasting consequences, active/resolved conflicts, decisions and emotional breakthroughs where present. Omit unsupported claims. Each fact must be directly supported by its short contiguous verbatim evidence excerpt. ending and currentSituation may be factual summaries if you provide supporting evidence excerpts. Limit each description/fact to 240 characters, each excerpt to 320 characters, at most 8 completedEvents, 16 developments, 10 resolvedMilestones, and 10 activeMysteries. Do not duplicate facts across arrays. Return only JSON:
{"number":${number},"ending":"final-state summary or excerpt","endingEvidence":"short exact excerpt supporting ending","currentSituation":"current-state summary or excerpt","currentSituationEvidence":"short exact excerpt supporting currentSituation","completedEvents":[{"description":"actual event","evidence":"exact excerpt"}],"developments":[{"category":"events","subject":"character or thing","fact":"concise actual fact","evidence":"exact excerpt"}],"resolvedMilestones":[{"item":"concrete promise/reveal/mechanism advancement completed in this chapter","status":"advanced|resolved|completed","evidence":"exact excerpt"}],"activeMysteries":[{"question":"still-unresolved mystery question","state":"open|partially answered|resolved","evidence":"exact excerpt"}]}
Allowed development categories: ${[...STATE_CATEGORIES].join(', ')}.
FINAL CHAPTER PROSE:
${chapter}`;
}
function buildStoryStateEntry({number, chapterText, extracted, previousState = {version:1, chapters:[]}}) {
  const entry = json(extracted);
  const history = previousState.chapters;
  if (!Array.isArray(history) || history.length !== number - 1 || history.some((e,i)=>e.number !== i+1)) throw new Error('Story history must remain sequential');
  const state = {version:1, chapters:[...history, entry]};
  return validateStoryState(state, number, chapterText);
}
function validateStoryState(raw, expectedNumber, chapterText) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.chapters)) throw new Error('Story state must be an object with a chapters array');
  if (raw.chapters.length !== expectedNumber || raw.chapters.some((e,i)=>e?.number !== i+1)) throw new Error('Story state must remain sequential');
  const last = raw.chapters.at(-1);
  if (!last || last.number !== expectedNumber) throw new Error(`Story state mismatch: expected chapter ${expectedNumber}`);
  const supportedText = (value, limit) => text(value) && value.length <= limit && hasEvidence(chapterText, value);
  const supportedSummary = (summary, evidence) => {
    if (!text(summary) || summary.length > 320) return false;
    if (hasEvidence(chapterText, summary)) return true;
    return text(evidence) && evidence.length <= 320 && hasEvidence(chapterText, evidence);
  };
  if (!supportedSummary(last.ending,last.endingEvidence) || !supportedSummary(last.currentSituation,last.currentSituationEvidence)) {
    throw new Error('Unsupported story-state ending or current situation');
  }
  if (!Array.isArray(last.completedEvents) || last.completedEvents.length > 8) throw new Error('Story state requires 0–8 completed events');
  for (const event of last.completedEvents) {
    if (!text(event?.description) || event.description.length > 240 || !supportedText(event.evidence,320)) throw new Error('Unsupported story-state evidence was rejected');
  }
  if (!Array.isArray(last.developments) || last.developments.length > 16) throw new Error('Invalid story-state developments');
  for (const d of last.developments) {
    if (!STATE_CATEGORIES.has(d?.category) || !text(d.subject) || d.subject.length > 120 || !text(d.fact) || d.fact.length > 240 || !supportedText(d.evidence,320)) throw new Error('Unsupported story-state development evidence was rejected');
  }
  const resolvedMilestones = Array.isArray(last.resolvedMilestones) ? last.resolvedMilestones : [];
  if (resolvedMilestones.length > 10) throw new Error('Invalid story-state resolved milestones');
  for (const milestone of resolvedMilestones) {
    if (!text(milestone?.item) || milestone.item.length > 240) throw new Error('Invalid resolved milestone item');
    const status = String(milestone?.status || '').toLowerCase();
    if (!['advanced','resolved','completed'].includes(status)) throw new Error('Invalid resolved milestone status');
    if (!supportedText(milestone?.evidence,320)) throw new Error('Unsupported resolved milestone evidence was rejected');
  }
  const activeMysteries = Array.isArray(last.activeMysteries) ? last.activeMysteries : [];
  if (activeMysteries.length > 10) throw new Error('Invalid story-state active mysteries');
  for (const mystery of activeMysteries) {
    if (!text(mystery?.question) || mystery.question.length > 240) throw new Error('Invalid active mystery question');
    const state = String(mystery?.state || '').toLowerCase();
    if (!['open','partially answered','resolved'].includes(state)) throw new Error('Invalid active mystery state');
    if (!supportedText(mystery?.evidence,320)) throw new Error('Unsupported active mystery evidence was rejected');
  }
  return raw;
}
// Five-word shingles detect copied sequences without confusing shared names/themes
// with copied prose. Coverage counts positions, retaining repeated passages.
function compareChapters(leftText, rightText) {
  const left = normalizeComparableText(leftText), right = normalizeComparableText(rightText);
  const a = left ? left.split(' ') : [], b = right ? right.split(' ') : [];
  const shingle = words => Array.from({length:Math.max(0,words.length-4)},(_,i)=>words.slice(i,i+5).join(' '));
  const aa=shingle(a), bb=shingle(b), aset=new Set(aa), bset=new Set(bb);
  const covered = (arr,set) => arr.length ? arr.filter(x=>set.has(x)).length / arr.length : 0;
  const ac=covered(aa,bset), bc=covered(bb,aset);
  const exact=Boolean(left && left === right);
  const similarity=exact ? 1 : Math.min(ac,bc);
  // Longest contiguous common sequence of shingles, computed in linear space.
  const positions=new Map();
  bb.forEach((v,i)=>{if(!positions.has(v)) positions.set(v,[]);positions.get(v).push(i);});
  let prior=new Map(), longest=0;
  for(const v of aa) {
    const next=new Map();
    for(const j of positions.get(v)||[]) {const length=(prior.get(j-1)||0)+1;next.set(j,length);longest=Math.max(longest,length);}
    prior=next;
  }
  const copiedWords=longest ? longest+4 : 0;
  let reason=null;
  if(exact) reason='Exact duplicate chapter text detected';
  else if(similarity >= 0.8) reason='Near-identical chapter text detected';
  else if((Math.min(a.length,b.length)>=120 && Math.max(ac,bc)>=0.5) || copiedWords>=100) reason='Substantial copied passages detected';
  return {similarity, currentCoverage:ac, previousCoverage:bc, copiedWords, reason};
}
function chapterSimilarity(left,right) {return compareChapters(left,right).similarity;}
function comparePreviousChapters(chapter, previous=[]) {
  return previous.map(p=>({chapterNumber:p.number,...compareChapters(chapter,p.text ?? p.content ?? '')}));
}
function detectDuplicateChapter(chapter,previous=[]) {
  return comparePreviousChapters(chapter,previous).find(c=>c.reason) || null;
}
const REPORT_FORMAT = `Return only JSON with exactly these fields: {"events":[{"index":0,"status":"dramatized","evidence":"exact short excerpt"}],"ending":{"met":true,"evidence":"exact short excerpt"},"issues":[{"severity":"major","certainty":"definite","category":"continuity","description":"specific problem","evidence":"exact excerpt or explicit missing-event explanation","correction":"concrete repair"}],"developments":[{"category":"events","subject":"who or what","fact":"actual accepted development","evidence":"exact short excerpt"}]}. Include one events entry for EVERY required event in order, using zero-based indexes. status is dramatized, missing, contradicted, or summarized. severity is critical, major, or minor; certainty is definite or possible. Development categories: locations, relationships, knowledge, abilities, events, conflicts, consequences, timeline, breakthroughs, items, promises, situation. Track only actual events, not planned future canon. Empty arrays are allowed except required event coverage. Never invent quotations.`;
function validateReport(raw, plan, chapter) {
  const r = json(raw);
  if (!r || !Array.isArray(r.events) || r.events.length !== plan.requiredEvents.length || !Array.isArray(r.issues) || !Array.isArray(r.developments) || typeof r.ending?.met !== 'boolean' || !text(r.ending.evidence)) throw new Error('Malformed narrative validation report');
  const normalizedEvents = normalizeEvents(r.events, plan.requiredEvents.length);
  normalizedEvents.forEach((e,i) => {
    if(e.index !== i || !['dramatized','missing','contradicted','summarized'].includes(e.status) || !text(e.evidence)) throw new Error(`Invalid event coverage for required event ${i + 1}: status=${JSON.stringify(e.status)}, evidence=${JSON.stringify(e.evidence)}`);
    if (e.status === 'dramatized' && !hasEvidence(chapter, e.evidence)) throw new Error(`Invented evidence for required event ${i + 1}: ${JSON.stringify(e.evidence)} is not an excerpt of the chapter`);
  });
  if (r.ending.met && !hasEvidence(chapter, r.ending.evidence)) throw new Error('Invented ending evidence');
  r.issues.forEach(i => {
    if (!['critical','major','minor'].includes(i.severity) || !['definite','possible'].includes(i.certainty) || !['category','description','evidence','correction'].every(k=>text(i[k]))) throw new Error('Invalid validation issue');
  });
  r.developments.forEach(d => {
    if (!['locations','relationships','knowledge','abilities','events','conflicts','consequences','timeline','breakthroughs','items','promises','situation'].includes(d.category) || !['subject','fact','evidence'].every(k=>text(d[k])) || !hasEvidence(chapter, d.evidence)) throw new Error('Invalid story-state evidence');
  });
  const failures = normalizedEvents.filter(e=>e.status !== 'dramatized').map(e=>({description:`Required event ${e.index + 1}: ${e.status}`, evidence:e.evidence, correction:plan.requiredEvents[e.index]}));
  if (!r.ending.met) failures.push({description:'Required ending not met', evidence:r.ending.evidence, correction:plan.ending});
  failures.push(...r.issues.filter(i=>i.certainty === 'definite' && ['critical','major'].includes(i.severity)));
  return {...r, events: normalizedEvents.map(({_position, _index, ...e}) => e), failures, passed:failures.length === 0};
}
function validationPrompt(bible, context, chapter) {
  return `You are a structural continuity validator, independent of literary ratings. Compare the actual prose to every required event in sequence, ending, bible, accepted history, previous chapter ending and future milestones. Fail missing, substituted, summarized or out-of-order mandatory scenes. Check premature introductions, unearned knowledge/abilities, locations/dates/ages/relationships, missing transitions, duplicate scenes/conversations/discoveries/confrontations or emotional breakthroughs, resets, unresolved promises, conflicts falsely assumed resolved and premature future developments. Distinguish definite contradictions from intentional mysteries, callbacks, recurring themes and stylistic freedom. Do not reject unconventional style. An emotionally similar scene cannot replace an assigned event. Identify the actual textual evidence and correction for each issue.\n${REPORT_FORMAT}\nBIBLE:\n${bible}\nCONTEXT:\n${JSON.stringify(context)}\nACTUAL CHAPTER:\n${chapter}`;
}
function acceptState(state, number, report) {
  if ((!report.passed && !report.advisory) || number !== state.chapters.length + 1) throw new Error('Cannot update canon before sequential chapter acceptance');
  // Append-only ledger: changes remain visible alongside the facts they supersede.
  return {version:1, chapters:[...state.chapters, {number, ending:report.ending.evidence, completedEvents:report.events.map(e=>({...e})), developments:report.developments.map(d=>({...d}))}]};
}
async function reviewAdvisory({draft, plan, validate, onAttempt = ()=>{}}) {
  onAttempt(1);
  let report;
  try {
    report = validateReport(await validate(draft), plan, draft);
  } catch (error) {
    // A broken report cannot supply trusted facts for future chapters.
    report = {passed:false, events:[], ending:{met:false, evidence:''}, developments:[], issues:[],
      failures:[{description:error.message}]};
  }
  return {chapter:draft, report:{...report, advisory:true}};
}
function maxAttempts(raw = process.env.CHAPTER_MAX_ATTEMPTS || '3') {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error('CHAPTER_MAX_ATTEMPTS must be an integer from 1 to 20');
  return n;
}
async function ensureValid({draft, plan, validate, repair, attempts = maxAttempts(), previousChapter = "", onAttempt = ()=>{}}) {
  maxAttempts(attempts);
  let chapter = draft, report, validationFeedback;
  for (let attempt=1; attempt<=attempts; attempt++) {
    onAttempt(attempt);
    // Transport errors must propagate; they are not chapter defects.
    const raw = await validate(chapter, validationFeedback);
    try { report = validateReport(raw, plan, chapter); }
    catch (error) {
      report = {passed:false, failures:[{description:error.message, correction:'Return a complete valid JSON report with exact evidence'}]};
      validationFeedback = report.failures;
      // Repair the validator's report on the same prose, not the author's chapter.
      continue;
    }
    validationFeedback = undefined;
    // Exact replay is a deterministic failure even if a model rubber-stamps it.
    const normalize = value => value.toLowerCase().replace(/\s+/g, ' ').trim();
    if (previousChapter && normalize(chapter) === normalize(previousChapter)) {
      report.passed = false;
      report.failures.push({description:'Chapter repeats the previous chapter verbatim', correction:'Regenerate the assigned chapter with new required developments'});
    }
    if (report.passed) return {chapter, report};
    if (attempt < attempts) chapter = await repair(chapter, report, attempt);
  }
  throw new Error(`Chapter ${plan.number} failed after ${attempts} validation attempts: ${JSON.stringify(report.failures)}`);
}
function similarTitle(title, existing) {
  const words = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(w=>w && !['a','an','the','of','in','and','to'].includes(w));
  const a = new Set(words(title));
  return !a.size || existing.some(t=> {
    const b = new Set(words(t)), shared = [...a].filter(w=>b.has(w)).length;
    return title.toLowerCase().trim() === t.toLowerCase().trim() || shared / Math.max(a.size,b.size) >= 0.5;
  });
}
async function uniqueTitle(generate, existing, attempts = maxAttempts()) {
  for (let i=0;i<attempts;i++) { const title = await generate(i); if (!similarTitle(title,existing)) return title; }
  throw new Error('Chapter title remained too similar to existing titles');
}
module.exports = {
  PLAN_FORMAT,
  REPORT_FORMAT,
  parsePlans,
  makeUsablePlans,
  parsePremiseCommitments,
  validatePremiseCoverage,
  contextFor,
  validateReport,
  validationPrompt,
  acceptState,
  ensureValid,
  reviewAdvisory,
  maxAttempts,
  similarTitle,
  uniqueTitle,
  storyStatePrompt,
  comparePreviousChapters,
  buildStoryStateEntry,
  validateStoryState,
  chapterSimilarity,
  detectDuplicateChapter,
  normalizeComparableText,
  validateOutlineStructure,
};
