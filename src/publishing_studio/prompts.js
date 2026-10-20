
const ROOT_ENV_PATH = path.join(__dirname, "..", "..", ".env");

// Shared helpers
const asText = (value) =>
  typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2);

const chapterLabel = (chapterNumber) => chapterNumber + 1;

const chapterCount = () => {
  const count = Number(process.env.CHAPTERS);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("CHAPTERS must be a positive integer.");
  }
  return count;
};

// ------------------------------------------------------------
// 1. GENERATE THE PLOTLINE
// ------------------------------------------------------------

function prompt1Plotline(description) {
  return `
TASK:
Transform the director's story concept into a cohesive, captivating
three-paragraph plotline covering the entire book.

STORY REQUIREMENTS:
- Preserve the director's core premise, genre, themes, and intentions.
- Establish a compelling protagonist with a clear desire, flaw, and
  internal conflict.
- Introduce a meaningful central conflict and an opposing force.
- Create strong cause-and-effect relationships between major events.
- Include escalating stakes, difficult choices, and meaningful consequences.
- Avoid predictable developments, generic villains, and convenient solutions.
- Ensure character decisions drive the plot rather than coincidences.
- Give the story an emotional and thematic throughline.
- Develop an ending that feels earned, satisfying, and consistent with
  the story's genre and intended tone.

STRUCTURE:

PARAGRAPH 1 — BEGINNING:
Introduce the protagonist, setting, ordinary circumstances, internal
struggle, inciting incident, and the decision that launches the story.

PARAGRAPH 2 — MIDDLE:
Describe the major complications, evolving relationships, escalating
conflicts, reversals, midpoint revelation, and the protagonist's
increasing personal sacrifices.

PARAGRAPH 3 — END:
Describe the crisis, darkest moment, climactic decisions,
final confrontation, resolution of the central conflict, and
the protagonist's transformation.

IMPORTANT:
- The plotline is an outline, not finished prose.
- Make it detailed enough to guide a full-length novel.
- Commit to concrete story events rather than vague possibilities.
- Surprise the reader without sacrificing logic.
- Do not introduce elements that contradict the director's description.

OUTPUT:
Exactly three substantial paragraphs.
No headings, commentary, introductions, or explanations.

DIRECTOR'S DESCRIPTION:
${description}
`;
}

// ------------------------------------------------------------
// 2. RATE THE PLOTLINE
// ------------------------------------------------------------

function prompt2RatePlotline(description, plotline) {
  return `
Evaluate the plotline critically. Do not praise it simply because
it is coherent. Be constructive, specific, and demanding.

SCORING CRITERIA (100 POINTS):
- Fidelity to director's vision: 20
- Originality and avoidance of clichés: 15
- Protagonist development and motivation: 15
- Conflict, tension, and stakes: 15
- Causal logic and narrative structure: 15
- Emotional impact and thematic depth: 10
- Climax and resolution: 10

Evaluate whether:
- The protagonist makes meaningful decisions.
- The central conflict can sustain an entire book.
- Important events develop logically.
- The middle escalates instead of becoming repetitive.
- Character arcs affect the outcome.
- The climax resolves conflicts established earlier.
- The ending feels earned rather than convenient.

Identify the three most important problems and describe specific,
practical ways to correct each.

SCORING RULES:
90-100: Exceptional and nearly publication-ready concept.
80-89: Strong with a few improvements needed.
70-79: Promising but has meaningful weaknesses.
60-69: Significant structural or creative issues.
Below 60: Requires substantial redevelopment.

OUTPUT FORMAT:
Score: X/100
Rating: X/10

Strengths: [brief explanation]

Weaknesses:
1. [specific problem and why it matters]
2. [specific problem and why it matters]
3. [specific problem and why it matters]

Recommended Changes:
1. [specific actionable change]
2. [specific actionable change]
3. [specific actionable change]

Verdict: [APPROVE or REVISE]

Do not rewrite the plotline.
Judge the work provided, not a hypothetical better version.

DIRECTOR'S ORIGINAL DESCRIPTION:
${description}

PLOTLINE TO EVALUATE:
${plotline}
`;
}

// ------------------------------------------------------------
// 3. CREATE THE STORY BIBLE
// ------------------------------------------------------------

function prompt3StoryBible(plotline) {
  return `
Create a comprehensive STORY BIBLE based on the following plotline.

The story bible will serve as the authoritative reference for
multiple AI authors collaborating on the same novel.

Your job is to define the story's world, characters, rules, history,
relationships, and narrative constraints in enough detail that
independent writers can produce consistent chapters.

REQUIRED SECTIONS:

1. STORY OVERVIEW
- Genre and subgenre
- Setting and time period
- Narrative tone and atmosphere
- Central premise
- Primary external conflict
- Primary internal conflict
- Core themes and thematic questions
- Intended emotional experience
- Planned ending and how it resolves the conflicts

2. WORLD AND SETTING
- Countries, regions, towns, and important locations
- Geography, climate, and environment
- Architecture, transportation, and technology
- Political systems, social hierarchy, and economics
- Cultural customs, traditions, and beliefs
- Fashion, clothing, and social appearance conventions
- Relevant historical events
- Any magic, supernatural, or speculative systems
- Rules, limitations, and costs of extraordinary abilities
- Relevant laws, social norms, or institutional constraints

Only include worldbuilding categories relevant to this story.
Do not add unnecessary fantasy or science-fiction elements
to a realistic setting.

3. MAIN CHARACTERS
For each major character include:
- Full name and any aliases
- Age and role in the story
- Physical appearance and distinguishing features
- Typical clothing, grooming, and mannerisms
- Personality, temperament, strengths, and weaknesses
- Background and formative experiences
- Core values, worldview, and personal beliefs
- Conscious goal and underlying emotional need
- Greatest fear, insecurity, and internal contradiction
- Important secrets and what they are hiding
- Relationships with other characters
- Speech patterns and dialogue characteristics
- Skills, resources, and practical limitations
- Character arc from beginning to end
- Key decisions and turning points
- Starting and ending emotional state

4. SUPPORTING CHARACTERS
For each recurring supporting character include:
- Identity, appearance, personality, and role
- Personal goal, motivation, and background
- Relationship to the central conflict
- Relationship to the main cast
- Contribution to the plot
- Any planned change or resolution

5. ANTAGONISTS AND OPPOSING FORCES
- Identity and background
- Motivations, worldview, and desired outcome
- Strengths, vulnerabilities, and resources
- Relationship to the protagonist
- Why the antagonist believes their actions are justified
- Their plan and methods
- Their role in escalating the conflict
- Their eventual outcome

Avoid villains who are evil without believable motivation
unless the plot specifically calls for such a character.

6. CHARACTER RELATIONSHIP MAP
Document important alliances, rivalries, friendships,
romantic relationships, family ties, betrayals, and power dynamics.

Describe how major relationships change throughout the story.

7. STORY TIMELINE
- Important events preceding the beginning
- Beginning-of-story situation
- Inciting incident
- Major turning points
- Midpoint
- Crisis
- Climax
- Resolution

Specify chronological order and durations where relevant.
Do not invent exact dates unless needed.

8. SECRETS, MYSTERIES, AND REVEALS
For each major secret or mystery specify:
- The underlying truth
- Who initially knows the truth
- Who believes something incorrect
- Clues and foreshadowing
- When the truth is revealed
- Consequences of the revelation

9. CONTINUITY RULES
Clearly list established facts that authors must preserve:
- Names, ages, appearances, and relationships
- World rules and limitations
- Geography and travel constraints
- Character knowledge and secrets
- Major historical and chronological facts
- Irreversible events and consequences

10. NARRATIVE GUIDELINES
- Recommended narrative perspective
- Recommended tense
- Prose style appropriate to the genre
- Tone and atmosphere
- Dialogue conventions
- Pacing expectations
- Emotional and thematic priorities
- Recurring symbols or motifs, where appropriate
- Genre-specific storytelling expectations

IMPORTANT:
- Preserve every major event and implication from the plotline.
- Fill necessary gaps with believable, internally consistent details.
- Clearly distinguish established canon from optional suggestions.
- Do not introduce random details that do not support the story.
- Avoid contradictions between character histories, world rules,
  relationships, and plot events.
- Favor useful, concrete information over generic descriptions.
- Make this a practical reference, not an encyclopedia of trivia.
- Do not rewrite the central plot or its planned ending.

OUTPUT:
A detailed, clearly organized story bible with section headings.
No introductions or commentary outside the story bible.

APPROVED PLOTLINE:
${plotline}
`;
}

// ------------------------------------------------------------
// 4. REVIEW THE STORY BIBLE
// ------------------------------------------------------------

function prompt4RateStoryBible(description, plotline, bible) {
  return `
Your responsibility is to detect anything that could cause
inconsistency, confusion, weak characterization, or poor storytelling.

EVALUATION CRITERIA (100 POINTS):
- Fidelity to original description and plotline: 20
- Character depth, goals, and motivations: 20
- Worldbuilding consistency and plausibility: 15
- Timeline and causal consistency: 15
- Relationship and antagonist development: 10
- Continuity usefulness for future authors: 10
- Originality and thematic cohesion: 10

CHECK FOR:
- Contradictory names, ages, dates, locations, or backstories.
- World rules that conflict with planned plot events.
- Characters without believable motives or distinct personalities.
- Missing characters required by the plotline.
- Characters who possess knowledge they should not have.
- Underdeveloped conflicts and relationships.
- Unexplained abilities, resources, or plot conveniences.
- Unnecessary additions that undermine the original premise.
- Unclear character arcs or unresolved core conflicts.

Distinguish genuine contradictions from intentional mysteries
and information that has not yet been revealed to readers.

OUTPUT FORMAT:
Score: X/100
Rating: X/10

Strengths: [brief assessment]

Critical Issues:
1. [issue, location, and exact correction]
2. [issue, location, and exact correction]

Missing Information:
1. [necessary detail and why it matters]
2. [necessary detail and why it matters]

Recommended Improvements:
1. [actionable recommendation]
2. [actionable recommendation]
3. [actionable recommendation]

Verdict: [APPROVE or REVISE]

Do not rewrite the bible.
If no critical issues exist, explicitly say so.
Do not invent issues simply to fill the review.

DIRECTOR'S DESCRIPTION:
${description}

APPROVED PLOTLINE:
${plotline}

STORY BIBLE TO REVIEW:
${bible}
`;
}

// ------------------------------------------------------------
// 5. WRITE THE CHAPTER OUTLINE
// ------------------------------------------------------------

function prompt5WriteChapterOutline(plotline, bible) {
  const CHAPTERS = chapterCount();

  return `
Develop a complete, detailed, chapter-by-chapter outline for
a novel containing EXACTLY ${CHAPTERS} chapters.

Use the approved plotline as the narrative blueprint and the story
bible as the authoritative continuity reference.

OBJECTIVES:
- Construct a cohesive beginning, middle, and ending.
- Build escalating tension throughout the novel.
- Develop the protagonist through meaningful choices and consequences.
- Ensure every chapter advances the plot, character development,
  relationship dynamics, or central mystery.
- Balance action, dialogue, introspection, discovery, and quieter moments.
- Use setups and payoffs across multiple chapters.
- Avoid repetitive conflicts and filler chapters.
- Distribute important revelations and turning points effectively.
- Preserve the planned climax and resolution.
- Give supporting characters purposeful contributions.

STRUCTURAL GUIDELINES:
- Early chapters introduce the protagonist, setting, and central conflict.
- The inciting incident changes the protagonist's circumstances.
- The middle develops complications, reversals, and mounting consequences.
- A meaningful midpoint changes the protagonist's understanding
  or approach.
- Later chapters intensify pressure and force difficult sacrifices.
- A major crisis tests the protagonist's central flaw or belief.
- The climax emerges from accumulated choices and conflicts.
- The ending resolves the central story and its emotional arc.

These are narrative guidelines, not rigid percentage formulas.

FOR EACH CHAPTER PROVIDE:

Chapter [number]

Working Title:
A short descriptive working title.

POV and Setting:
The viewpoint character and primary location(s).

Timeline:
When this chapter happens relative to surrounding chapters.

Chapter Purpose:
What this chapter accomplishes in the overall novel.

Opening Situation:
The immediate situation, problem, or emotional state.

Scene-by-Scene Beats:
Describe 3-7 meaningful scenes or narrative beats in order.
For each, identify:
- The characters involved
- What each relevant character wants
- The conflict or obstacle
- The meaningful event or discovery
- How the situation changes

Character Development:
How this chapter changes important characters or relationships.

Conflict and Stakes:
What becomes more difficult, dangerous, or emotionally costly.

Setup and Payoff:
Important clues, promises, revelations, or consequences.

Continuity Requirements:
Relevant facts from earlier chapters that must remain consistent.

Chapter Ending:
End on a meaningful revelation, decision, consequence,
emotional turn, or unresolved tension.

Not every ending needs a shocking twist or cliffhanger.
Use the type of ending that best serves the pacing.

MANDATORY RULES:
- Produce exactly ${CHAPTERS} chapters.
- Use a coherent chronological sequence unless a nonlinear
  structure is deliberately supported by the story bible.
- Do not contradict the plotline or established canon.
- Ensure important events receive sufficient setup.
- Ensure choices create consequences in later chapters.
- Do not introduce major characters or abilities without
  appropriate narrative justification.
- Give the final chapter a satisfying emotional resolution.

OUTPUT:
Only the complete chapter outline.
No introductions, explanations, or editorial notes.

OVERALL PLOTLINE:
${plotline}

STORY BIBLE:
${bible}
`;
}

// ------------------------------------------------------------
// 6. REVIEW THE CHAPTER OUTLINE
// ------------------------------------------------------------

function prompt6RateChapterOutline(plotline, bible, chapterOutline) {
  return `
Critically review the chapter outline against the approved plotline
and story bible.

EVALUATE:
- Fidelity to the intended plot and ending
- Chapter-to-chapter cause and effect
- Beginning, middle, and ending structure
- Pacing and distribution of major events
- Escalation of stakes and conflict
- Character decisions and development
- Protagonist agency
- Supporting character relevance
- Foreshadowing and payoff
- Continuity with established story facts
- Unnecessary scenes and repetitive conflicts
- Whether chapter endings create meaningful momentum

For every meaningful issue, identify:
1. The specific chapter or chapters affected.
2. What is wrong.
3. Why it harms the novel.
4. A concrete way to fix it.

Prioritize improvements with the greatest narrative impact.
Do not recommend changes merely because of personal stylistic taste.
Do not propose changes that violate established canon.

OUTPUT FORMAT:
Score: X/10

What Works:
[brief explanation]

Priority Issues:
1. [chapter reference, problem, reason, solution]
2. [chapter reference, problem, reason, solution]
3. [chapter reference, problem, reason, solution]

Continuity Issues:
[list genuine contradictions, or "None detected"]

Suggested Structural Changes:
[concrete improvements in priority order]

Verdict: [APPROVE or REVISE]

Do not rewrite the chapter outline.

APPROVED PLOTLINE:
${plotline}

STORY BIBLE:
${bible}

CHAPTER OUTLINE TO REVIEW:
${chapterOutline}
`;
}

// ------------------------------------------------------------
// 7. IMPROVE THE CHAPTER OUTLINE
// ------------------------------------------------------------

function prompt7ImproveChapterOutline(
  bible,
  chapterOutline,
  arrayOfFeedback
) {
  return `
You have received feedback from multiple independent editors.

YOUR TASK:
Produce an improved, complete chapter outline.

REVISION PROCESS:
- Consider all feedback carefully.
- Identify genuine weaknesses and high-impact recommendations.
- Prioritize corrections involving plot logic, pacing,
  characterization, stakes, and continuity.
- Resolve overlapping or conflicting feedback using your judgment.
- Reject feedback that would weaken the story or violate canon.
- Preserve effective ideas and scenes from the original outline.
- Improve transitions and cause-and-effect relationships.
- Ensure any changed chapter remains consistent with later chapters.
- Maintain the original number of chapters.
- Preserve the planned central conflict, character arcs, and ending
  unless the story bible explicitly permits a change.

Do not make unnecessary changes simply to demonstrate revision.
Every substantial alteration must improve the narrative.

QUALITY CHECK BEFORE OUTPUT:
- Are chapter numbers complete and sequential?
- Does every chapter have a clear narrative purpose?
- Does tension rise and evolve?
- Do characters behave according to established motivation?
- Are important setups paid off?
- Does the ending remain properly supported?
- Are there contradictions or abandoned major story threads?

OUTPUT:
Return only the complete revised chapter outline.
Preserve the same chapter-by-chapter format as the original.
No editorial commentary or explanation of changes.

STORY BIBLE:
${bible}

ORIGINAL CHAPTER OUTLINE:
${chapterOutline}

EDITORIAL FEEDBACK:
${asText(arrayOfFeedback)}
`;
}

// ------------------------------------------------------------
// 8. WRITE CHAPTER X
// ------------------------------------------------------------

function prompt8WriteChapterX(
  bible,
  chapterOutline,
  chapterNumber,
  lastChapter
) {
  const number = chapterLabel(chapterNumber);
  const words = Number(process.env.CHAPTER_WORDS) || 3000;

  return `
Write Chapter ${number} of the novel as polished literary fiction
appropriate to its established genre and intended audience.

You are writing the actual book, not an outline or summary.

AUTHORITATIVE REFERENCES:
- The story bible defines the world, characters, and continuity.
- The approved chapter outline defines major story events.
- The previous chapter provides immediate narrative continuity.

WRITING REQUIREMENTS:

1. IMMERSIVE PROSE
- Write vivid, natural prose suited to the novel's genre and tone.
- Use concrete sensory details where they enhance the scene.
- Favor precise language over excessive adjectives.
- Vary sentence structure and paragraph rhythm naturally.
- Avoid clichéd imagery, stock phrases, and generic descriptions.
- Avoid repeatedly describing the same emotions or surroundings.

2. SHOW CHARACTER THROUGH ACTION
- Reveal personality through behavior, decisions, dialogue,
  contradictions, and reactions.
- Use internal thoughts when appropriate to the chosen POV.
- Convey important emotions through meaningful details rather
  than repeatedly naming those emotions.
- Allow moments of direct narration when they are more effective
  than dramatization.
- Preserve each character's established voice and motivations.

3. AUTHENTIC DIALOGUE
- Give major characters distinct speaking patterns.
- Use subtext, disagreement, hesitation, and implication naturally.
- Avoid dialogue that exists solely to explain background information.
- Avoid repetitive exchanges that do not change the scene.
- Combine dialogue with actions and reactions when appropriate.

4. SCENE CONSTRUCTION
- Give important scenes a clear desire, obstacle, development,
  and consequence.
- Dramatize key events instead of summarizing them away.
- Allow important emotional moments room to develop.
- Use effective transitions between scenes.
- Balance dialogue, description, action, and interiority.
- Maintain narrative momentum without rushing every moment.

5. CONTINUITY
- Follow the events assigned to Chapter ${number}.
- Preserve established world rules and character histories.
- Maintain knowledge boundaries: characters only know what
  they have plausibly learned.
- Respect prior injuries, promises, secrets, relationships,
  locations, and recent events.
- Follow the established narrative tense and POV conventions.
- Begin naturally from the previous chapter when provided.
- Do not prematurely reveal major events reserved for later chapters.
- Do not resolve conflicts intended to continue.

6. CREATIVE EXECUTION
- You may expand scenes, dialogue, minor interactions, and
  descriptive details to improve the reading experience.
- You may introduce small, plausible details consistent with canon.
- You must preserve the chapter's essential narrative beats.
- Avoid convenient coincidences or unsupported new abilities.
- Do not add filler solely to increase word count.

LENGTH:
Target approximately ${words} words.
Prioritize a fully realized chapter over hitting the target exactly.
Do not end abruptly or artificially extend scenes.

ENDING:
Conclude at the intended chapter endpoint with the appropriate
emotional impact, revelation, decision, or unresolved tension.

FINAL SELF-CHECK:
Before responding, silently verify that this reads like a
professional novel chapter rather than AI-generated exposition.

OUTPUT:
Only the complete prose of Chapter ${number}.
Do not include a chapter title, outline, notes, word count,
or explanations.

STORY BIBLE:
${bible}

COMPLETE CHAPTER OUTLINE:
${chapterOutline}

PREVIOUS CHAPTER:
${lastChapter || "This is Chapter 1. No previous chapter exists."}
`;
}

// ------------------------------------------------------------
// 9. REVIEW CHAPTER X
// ------------------------------------------------------------

function prompt9ReviewChapterX(
  bible,
  chapterOutline,
  chapterNumber,
  chapter
) {
  const number = chapterLabel(chapterNumber);

  return `
Review Chapter ${number} as a finished draft intended for publication.

Evaluate the chapter against the story bible and approved outline,
while also assessing its quality as immersive fiction.

REVIEW DIMENSIONS:
- Adherence to the chapter's intended events
- Continuity with characters, world, and timeline
- Character authenticity and emotional depth
- Prose clarity, rhythm, and originality
- Dialogue realism and character voice
- Scene construction and dramatic tension
- Pacing and unnecessary exposition
- Reader engagement and atmosphere
- Quality of the opening and ending

Look specifically for:
- Telling where dramatization would be stronger
- Dialogue that feels artificial or interchangeable
- Exposition dumps
- Repetitive emotional descriptions
- Generic or clichéd sentences
- Abrupt or unearned emotional changes
- Passive protagonists
- Confusing spatial or temporal transitions
- Important outline beats that were omitted or rushed
- Contradictions with the story bible

IMPORTANT:
Judge the chapter on what actually appears in the text.
Do not invent problems or demand stylistic changes without reason.
Preserve the author's strongest creative choices.
Prioritize improvements that materially improve the reader's
experience.

OUTPUT FORMAT:
Score: X/10

Strengths:
[brief, specific explanation]

Critical Issues:
1. [specific issue, location, and suggested correction]
2. [specific issue, location, and suggested correction]
3. [specific issue, location, and suggested correction]

Prose and Dialogue Improvements:
[specific recommendations, with short examples where useful]

Continuity Issues:
[concrete contradictions, or "None detected"]

Top Revision Priority:
[the single most important change]

Verdict: [APPROVE or REVISE]

Do not rewrite the chapter.
Do not provide generic encouragement.

STORY BIBLE:
${bible}

APPROVED CHAPTER OUTLINE:
${chapterOutline}

CHAPTER ${number} TO REVIEW:
${chapter}
`;
}

// ------------------------------------------------------------
// 10. IMPROVE CHAPTER X
// ------------------------------------------------------------

function prompt10ImproveChapterX(
  bible,
  chapterOutline,
  chapterNumber,
  chapter,
  arrayOfFeedback
) {
  const number = chapterLabel(chapterNumber);

  return `
YOUR TASK:
Rewrite the provided chapter into a stronger, polished final draft.

EDITORIAL APPROACH:
- Preserve what already works.
- Correct genuine continuity, structure, and characterization problems.
- Improve weak dialogue, scene transitions, pacing, and prose.
- Expand important moments that were rushed.
- Condense repetitive or unnecessary passages.
- Replace clichés with more specific, natural language.
- Strengthen character agency and emotional authenticity.
- Preserve or improve the chapter's most effective images,
  revelations, interactions, and dramatic moments.
- Maintain consistency with the story bible and chapter outline.

FEEDBACK RULES:
- Treat editorial feedback as recommendations, not absolute commands.
- Prioritize recurring feedback pointing to the same weakness.
- Resolve conflicting advice using professional creative judgment.
- Reject suggestions that contradict established canon.
- Avoid adding new contradictions while fixing existing ones.
- Do not introduce major story changes without justification.
- Do not remove essential scenes or information from the outline.

REVISION QUALITY:
The result must be a coherent finished chapter, not a series
of patched passages.

Ensure the revised chapter flows naturally from beginning to end
and retains the original narrative perspective, tense, and tone.

Do not make the writing excessively ornate or verbose.
Prioritize specificity, clarity, emotional depth, and dramatic impact.

OUTPUT:
Only the entire revised prose of Chapter ${number}.
No introduction, revision summary, editor's notes, or commentary.
Do not include a chapter title.

STORY BIBLE:
${bible}

APPROVED CHAPTER OUTLINE:
${chapterOutline}

ORIGINAL CHAPTER ${number}:
${chapter}

EDITORIAL FEEDBACK:
${asText(arrayOfFeedback)}
`;
}

// ------------------------------------------------------------
// 11. GENERATE CHAPTER TITLE
// ------------------------------------------------------------

function prompt11WriteChapterName(
  bible,
  chapterOutline,
  chapterNumber,
  chapter
) {
  const number = chapterLabel(chapterNumber);

  return `
Create a memorable title for Chapter ${number}.

REQUIREMENTS:
- Reflect the chapter's actual events, emotional significance,
  atmosphere, or central theme.
- Match the novel's genre and tone.
- Be concise, evocative, and distinctive.
- Prefer subtle meaning over literal plot summaries when appropriate.
- Avoid generic phrases and overused dramatic titles.
- Avoid spoiling major revelations unless intentional.
- Favor a title that gains meaning after reading the chapter.

OUTPUT:
Exactly one chapter title.
No quotation marks, chapter number, alternatives, or explanations.

STORY BIBLE:
${bible}

CHAPTER OUTLINE:
${chapterOutline}

FINISHED CHAPTER:
${chapter}
`;
}

// ------------------------------------------------------------
// 12. GENERATE BOOK TITLE
// ------------------------------------------------------------

function prompt12WriteBookName(bible, chapterOutline) {
  return `
Create the strongest possible title for this book.

REQUIREMENTS:
- Reflect the book's central themes, emotional identity,
  premise, or defining imagery.
- Fit its genre and intended audience.
- Be memorable and easy to say aloud.
- Avoid generic or overused phrases.
- Avoid awkward wording and unnecessarily long titles.
- Prefer distinctive titles that create curiosity.
- Do not reveal the ending or important twists.
- Ensure the title feels appropriate for the complete story,
  not merely its opening chapters.

Internally consider multiple candidates and select the strongest
based on originality, memorability, genre fit, and thematic relevance.

OUTPUT:
Exactly one final book title.
No quotation marks, subtitles unless genuinely useful,
explanations, or alternative suggestions.

STORY BIBLE:
${bible}

COMPLETE CHAPTER OUTLINE:
${chapterOutline}
`;
}

// ------------------------------------------------------------
// 13. GENERATE BOOK COVER ART PROMPT
// ------------------------------------------------------------

function prompt13MakeBookCover(
  bible,
  title,
  authorsName,
  chapterArray
) {
  return `
Create a professional, visually striking illustrated cover
for the following novel.

The finished result should resemble premium, hand-drawn
commercial book cover artwork, not generic AI-generated imagery.

ART DIRECTION:
- Identify the novel's genre, central atmosphere, strongest
  visual symbolism, and intended emotional impact.
- Select one compelling focal image or illustration.
- Use a distinctive composition with a strong visual hierarchy.
- Develop a harmonious color palette matching the book's tone.
- Use lighting, contrast, and visual texture to convey atmosphere.
- Make the illustration evocative rather than overcrowded.
- Avoid depicting major spoilers or unnecessary characters.
- Keep characters and locations visually consistent with the bible.
- Ensure the design remains recognizable as a small thumbnail.
- Aim for a polished, bookstore-quality result.

ILLUSTRATION STYLE:
Hand-drawn or painterly illustration with carefully composed
details, sophisticated visual storytelling, and natural texture.
Choose an artistic treatment appropriate to the novel's genre.

COVER COMPOSITION:
- Vertical book cover, 2:3 aspect ratio.
- Clear focal point.
- Appropriate negative space for typography.
- Strong distinction between foreground and background.
- Cohesive illustration and text layout.

TEXT TO INCLUDE:
Book title: ${title}
Author name: ${authorsName}

TYPOGRAPHY:
- Integrate the exact book title prominently and legibly.
- Include the exact author name in a complementary style.
- Match type treatment to the genre and visual identity.
- Do not include extra words, fake awards, or fictional blurbs.

IMPORTANT:
Use the manuscript and story bible as creative references.
Do not attempt to illustrate every event in the book.
Choose a single visual concept that represents its identity.
Avoid revealing major twists or the ending.

OUTPUT:
Generate the final cover image.
Do not output a written explanation.

STORY BIBLE:
${bible}

BOOK TITLE:
${title}

AUTHOR NAME:
${authorsName}

FULL MANUSCRIPT:
${asText(chapterArray)}
`;
}
