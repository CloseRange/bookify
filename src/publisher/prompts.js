const { PLAN_FORMAT } = require("./narrative");


// Shared helpers
const asText = (value) =>
  typeof value === "string" ? value : JSON.stringify(value ?? [], null, 2);

const truncatePromptText = (value, maxChars = 4000) => {
  const text = typeof value === "string" ? value : asText(value ?? "");
  if (!text) {
    return "";
  }

  if (text.length <= maxChars) {
    return text.trim();
  }

  return `${text.slice(0, maxChars - 140).trim()}\n...[TRUNCATED for prompt length limits]`;
};

const chapterLabel = (chapterNumber) => chapterNumber;

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
Create an original plot concept for a full-length book based on
the director's description.

CREATIVE DIRECTION:
Interpret the premise through your own artistic identity,
imagination, preferences, and storytelling instincts.

You have creative freedom to determine:
- The characters and their motivations.
- The setting and atmosphere.
- The central events and narrative direction.
- The nature of any conflicts or challenges.
- The structure, pacing, and emotional tone.
- The ending and its significance.

There is no required plot formula. A story may be intimate,
adventurous, comedic, suspenseful, experimental, or anything
else appropriate to the premise.

You may use conventional storytelling techniques or explore
unusual possibilities. Choose what genuinely interests you
as an author.

REQUIREMENTS:
- Preserve the director's explicit requirements and intentions.
- Develop a specific, original story rather than a generic premise.
- Describe what actually happens, including how the story ends.
- Keep the concept coherent and suitable for development into
  a full-length book.
- Allow the story's natural direction to determine its structure.
- Avoid relying automatically on familiar narrative formulas.

OUTPUT:
Write a detailed synopsis of your proposed book.

Use as many paragraphs as naturally needed to communicate
the story. Do not include headings, explanations, or commentary.

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

0. PREMISE COMMITMENTS
- List the original story promises the final manuscript must pay off.
- Identify the central mystery or driving dramatic question.
- Identify concrete reveal moments the story must deliver.
- Identify causal rules/mechanisms that make the premise work.
- Identify required ending payoffs that must be shown on-page.
- Distinguish mandatory commitments from optional flavor.

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

function prompt5WriteChapterOutline(plotline, bible, premiseCommitments = null) {
  const CHAPTERS = chapterCount();

  return `
You are an accomplished novelist and story architect.

Create a complete, detailed outline for a novel of EXACTLY ${CHAPTERS} chapters.

The outline will be used by an AI author who writes each chapter once.
There will be NO chapter rewriting or editorial revision after writing.

Therefore, the outline must provide a coherent, complete, non-repetitive narrative blueprint.

AUTHORIAL FREEDOM:
Respect the approved plotline, genre, themes, and author's creative identity.
The story may be literary, quiet, experimental, action-driven, comedic,
romantic, mysterious, or any other appropriate form.

Do not impose a rigid three-act formula or force unnecessary action.
However, each chapter must accomplish something meaningful and distinct.

CORE REQUIREMENT: NARRATIVE PROGRESSION

Every chapter must have:
1. A distinct narrative purpose.
2. A concrete starting situation.
3. A specific goal, problem, question, or dramatic tension.
4. Observable events that develop the story.
5. A meaningful change by the chapter's conclusion.
6. A clearly established ending situation.
7. A causal relationship with surrounding chapters.

Emotional development is important, but repeating an established lesson
without a new decision, complication, consequence, or understanding
is not meaningful progression.

DISTINCT CHAPTER EVENTS:

Required events must describe what ACTUALLY HAPPENS.

Weak:
"The characters discuss working together to defeat the villain."

Stronger:
"The characters disagree over two plans, abandon one after discovering
a hidden weakness, and commit resources to a specific course of action."

Weak:
"The protagonist struggles with insecurity."

Stronger:
"The protagonist refuses a dangerous assignment because of self-doubt,
forcing an ally to take the risk and permanently changing their relationship."

A conversation, reflection, investigation, or quiet scene can be central
to a chapter when it produces a genuine narrative development.

Avoid consecutive chapters that:
- Repeat the same discussion or strategy.
- Teach the protagonist the same emotional lesson.
- Revisit an unchanged problem without new consequences.
- Repeatedly introduce the same ability or relationship.
- Delay an already established objective without a new obstacle.
- Begin and end in essentially the same narrative situation.

CAUSE AND EFFECT:

Each chapter must build on what actually happens before it.

If Chapter 4 ends with characters deciding to enter a dangerous location,
Chapter 5 must show an appropriate next development, such as beginning
the journey, encountering an obstruction, changing the mission, or
discovering a consequence.

Do not simply repeat the Chapter 4 planning conversation.

Ensure transitions across locations and time are plausible.

SETUPS AND PAYOFFS:

Important developments must have appropriate preparation.

Before a major character:
- Dies or is seriously injured,
- Betrays someone,
- Makes a major sacrifice,
- Reveals an important secret,
- Uses a significant new ability,
- Changes a major relationship,

ensure previous chapters have established the necessary context.

A supporting character should not appear for the first time at the
moment the audience is expected to feel deeply about their loss.

Track character introductions accurately. Do not mark a character
as introduced unless a required event actually establishes them.

CHARACTER DEVELOPMENT:

Give important characters distinct motivations, worldviews,
decision-making styles, weaknesses, and practical contributions.

Characters may share themes without expressing identical conflicts.

The protagonist's development must be cumulative.

After a character overcomes an obstacle, later challenges should test
the consequences of that progress rather than erase it.

ESCALATION AND PACING:

Create variety in scene types, locations, conflicts, and outcomes.

Use action, dialogue, discovery, reflection, suspense, humor,
quiet moments, setbacks, and relationships when appropriate.

Do not mistake constant intensity for good pacing.

Quiet chapters are welcome, but they must still produce meaningful change.

The middle of the novel must develop new complications and consequences
rather than repeatedly preparing for the climax.

REVELATIONS AND CLIMAX:

Specify exactly when important information becomes known.

If a major reveal occurs in Chapter 9, it must actually occur there,
not merely be hinted at or postponed.

If the central conflict is resolved in Chapter 10, the decisive event
must actually happen in Chapter 10.

Never assume major events occurred between chapters without being shown.

The ending must follow from earlier actions, revelations, and consequences.

PREMISE FULFILLMENT:

Identify the manuscript's core premise promises and ensure the outline
delivers them through concrete scenes, not vague implications.

For each core promise, plan:
- where it is setup,
- where evidence accumulates,
- where the key reveal occurs,
- and where the ending payoff is concretely delivered.

If the premise includes a specific mechanism (for example, a ritual,
device, rule system, or causal trigger), the outline must explicitly show:
- how it works,
- how characters test or misunderstand it,
- what consequences follow,
- and how the final chapters resolve its unanswered questions.

Do not end with the core mechanism unexplained or unresolved.

STRUCTURED OUTPUT REQUIREMENTS:

Use the provided JSON schema exactly.

For each chapter:

"purpose":
A specific and unique narrative function.

"start":
The concrete starting situation, including relevant location,
characters, and circumstances.

"requiredEvents":
A sequence of concrete, dramatizable events.
Each must describe an observable occurrence, decision, discovery,
interaction, conflict, or consequence.

"ending":
The actual situation reached at the end of the chapter.
Make it concrete and consistent with the next chapter.

"introductions":
Only characters genuinely introduced in that chapter.

"optionalDetails":
Creative suggestions that are not mandatory plot requirements.

Do not add unsupported JSON fields.

FINAL WHOLE-BOOK CHECK:

Before producing the outline, internally compare all chapters.

For every adjacent pair ask:
- Are their main events meaningfully different?
- Does the second build on the first?
- Is any conversation, training sequence, revelation, or confrontation repeated?
- Does the later chapter change the story in a new way?

For every major payoff ask:
- Where was it established?
- Why should the reader care?
- Has the necessary information already been introduced?

Repair weaknesses before returning the outline.

OUTPUT:
Return ONLY the complete structured chapter outline.

${PLAN_FORMAT}

APPROVED PLOTLINE:
${plotline}

STORY BIBLE:
${bible}

PREMISE COMMITMENTS:
${asText(premiseCommitments || {})}
`;
}

// ------------------------------------------------------------
// 6. REVIEW THE CHAPTER OUTLINE
// ------------------------------------------------------------

function prompt6RateChapterOutline(plotline, bible, chapterOutline) {
  return `
You are a demanding developmental editor reviewing a complete novel outline.

Your responsibility is to identify structural problems BEFORE the author
begins writing.

Each chapter will be written once and accepted as final.
There will be no chapter-by-chapter editorial revision.

Therefore, your evaluation must prioritize narrative completeness,
coherence, distinctiveness, and proper setup.

Do not approve an outline simply because it sounds interesting,
contains appealing themes, or follows a recognizable narrative structure.

EVALUATION CRITERIA:

1. DISTINCT CHAPTER PURPOSES
Does every chapter accomplish something different and necessary?

2. CONCRETE EVENTS
Are requiredEvents specific occurrences rather than generic emotional
themes, discussions, or promises about future action?

3. CAUSAL CONTINUITY
Does each chapter logically follow the previous chapter's ending?

4. PROGRESSIVE CHARACTER DEVELOPMENT
Do characters retain lessons, knowledge, relationships, and consequences?

5. REPETITION
Do adjacent or nearby chapters repeat:
- The same discussion?
- The same training exercise?
- The same emotional breakthrough?
- The same confrontation?
- The same planning session?
- The same discovery?
- The same outcome?

6. SETUP AND PAYOFF
Are important characters, abilities, relationships, losses,
revelations, and sacrifices established before their payoffs?

7. PACING
Does the novel have meaningful variety and momentum without
unnecessary filler or artificial action?

8. ANTAGONIST AND CENTRAL CONFLICT
Does the opposing force develop meaningfully?
Are the climax and resolution explicit and properly supported?

9. CHARACTER DISTINCTIVENESS
Do major characters contribute different perspectives,
actions, decisions, and consequences?

10. OUTLINE COMPLETENESS
Are significant transitions and turning points shown rather
than assumed to have happened between chapters?

MANDATORY CHAPTER-BY-CHAPTER AUDIT:

Examine every chapter individually.

For each chapter identify:
- Main narrative event.
- What changes by the ending.
- Whether its events are concrete enough to write.
- Whether required setup exists.
- Whether it overlaps another chapter.
- PASS or FAIL.

MANDATORY ADJACENT-CHAPTER AUDIT:

Compare each neighboring pair of chapters.

A planning chapter followed by another substantially identical
planning chapter is a structural failure unless the second
introduces a genuinely distinct development.

A character learning the same lesson multiple times without
new consequences is a structural failure.

Do not reject legitimate thematic callbacks or deliberate
repetition that produces a substantively different meaning.

CRITICAL FAILURE CONDITIONS:

Return REVISE if:
- A chapter lacks a meaningful distinct development.
- Consecutive chapters substantially duplicate their central event.
- An important payoff lacks necessary setup.
- A major plot event is assumed to occur off-page.
- Chapter starts and endings contain serious contradictions.
- The climax or central resolution is missing or ambiguous.
- A required character introduction is absent.
- An intended event is only discussed when it must occur.

A high numerical rating cannot override a critical failure.

Be specific and evidence-based.
Identify exact chapter numbers and describe concrete corrections.
Do not invent problems simply to sound demanding.

OUTPUT FORMAT:

Score: X/10

Overall Assessment:
[Concise judgment of the outline's structural quality.]

Chapter-by-Chapter Audit:
[For EVERY chapter, identify its unique event, resulting change,
important dependencies, and PASS or FAIL.]

Repetition and Overlap:
[List chapter pairs with overlapping dramatic purposes.
Explain what should be changed. Write "None detected" if appropriate.]

Missing Setups:
[Identify events lacking necessary earlier preparation.
Specify where the preparation should occur.]

Continuity Issues:
[List actual contradictions or "None detected".]

Critical Issues:
1. [Problem, chapter numbers, consequences, exact correction]
2. [Problem, chapter numbers, consequences, exact correction]
3. [Problem, chapter numbers, consequences, exact correction]

Recommended Structural Changes:
[Prioritized, actionable improvements.]

Verdict: [APPROVE or REVISE]

APPROVE only if the outline has no major structural defects.

Do not rewrite the outline.

APPROVED PLOTLINE:
${plotline}

STORY BIBLE:
${bible}

CHAPTER OUTLINE:
${asText(chapterOutline)}
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
You are an expert novelist revising a complete chapter outline
based on developmental editorial feedback.

This revision happens BEFORE any chapters are written.

The finished outline must be detailed, coherent, and suitable
for an author who writes each chapter only once.

YOUR RESPONSIBILITIES:

1. Carefully evaluate the editorial feedback.
2. Identify genuine structural defects.
3. Correct all substantiated critical problems.
4. Preserve the story's strongest creative ideas.
5. Maintain consistency with the approved story bible.
6. Preserve the intended central conflict and ending.
7. Return a complete revised outline.

PRIORITY 1: REMOVE NARRATIVE REPETITION

Compare the central events of every chapter.

If two chapters repeat the same planning discussion,
training sequence, emotional realization, confrontation,
or discovery, redesign the weaker chapter.

Do not simply change the wording of a repeated event.

Create a new narrative development that makes the
chapter distinct and necessary.

PRIORITY 2: STRENGTHEN REQUIRED EVENTS

Make each chapter's requiredEvents concrete.

Replace vague requirements such as:
"The characters grow closer and discuss the threat."

With events that specify:
- What they do.
- What motivates their actions.
- What new obstacle or information appears.
- What decision or consequence follows.

Allow creative and quiet scenes, but ensure they
produce a meaningful development.

PRIORITY 3: FIX CAUSAL CONTINUITY

Ensure that every chapter begins from a situation
logically established by previous chapters.

Do not jump between locations, major events, or
character states without a plausible transition.

Do not assume major events occurred off-page.

PRIORITY 4: REPAIR SETUPS AND PAYOFFS

Establish important characters, relationships, secrets,
abilities, and circumstances before their major payoffs.

For example, a mentor who will be injured in Chapter 6
should have meaningful development in an earlier chapter.

Do not introduce major elements only when they become
necessary to produce emotional impact.

PRIORITY 5: MAKE CHARACTER DEVELOPMENT CUMULATIVE

Characters must retain previous experiences.

Revisiting an insecurity is acceptable only when
the new situation presents a different challenge,
decision, consequence, or understanding.

Avoid repeatedly solving a character's central conflict
through essentially identical conversations.

PRIORITY 6: STRENGTHEN THE CLIMAX AND ENDING

Ensure the central confrontation actually occurs.

Any important revelation must happen in its assigned chapter.

Any important resolution must happen before a later
chapter assumes it has been completed.

The ending should resolve the central narrative through
events, choices, and consequences established earlier.

PRIORITY 7: FULFILL THE PREMISE PROMISES

Audit the outline against the story's original promises.

For each promise, ensure the outline contains:
- explicit setup,
- investigative or causal development,
- a concrete reveal,
- and an ending payoff on-page.

If the premise depends on a specific mechanism or mystery,
do not leave it under-explained or unresolved.

PRESERVE CREATIVE FREEDOM:

Do not force the story into a rigid formula.

Do not add unnecessary battles, deaths, betrayals, or
dramatic twists simply to create variety.

Distinct progression can come from relationships,
investigations, choices, discoveries, personal sacrifices,
or subtle but consequential changes.

OUTPUT CONSTRAINTS:

- Maintain the original number of chapters.
- Keep chapter numbers complete and sequential.
- Preserve the supported JSON schema exactly.
- Do not introduce unsupported fields.
- Preserve established canon.
- Keep each chapter's purpose unique.
- Make every required event clear and dramatizable.
- Ensure endings establish valid starting states for later chapters.

FINAL INTERNAL VERIFICATION:

Before responding:
- Compare every adjacent chapter pair.
- Identify and eliminate unnecessary duplicated events.
- Verify that major payoffs have earlier setups.
- Verify character introductions.
- Verify location and time continuity.
- Verify the climax occurs and resolves appropriately.
- Verify that revisions have not created new contradictions.

OUTPUT:
Return ONLY the complete revised chapter outline.

${PLAN_FORMAT}

STORY BIBLE:
${bible}

ORIGINAL CHAPTER OUTLINE:
${asText(chapterOutline)}

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
  bookSoFar,
  storySoFarSummary = "",
  minPages = 5,
  maxPages = 10,
  context = {}
) {
  if (chapterOutline && typeof chapterOutline === 'object' && chapterOutline.number !== Number(chapterNumber)) {
    throw new Error(`Chapter ${chapterNumber} cannot use plan ${chapterOutline.number}`);
  }
  const number = chapterLabel(chapterNumber);
  const words = Number(process.env.CHAPTER_WORDS) || 3000;

  return `
You are a professional novelist writing Chapter ${number}
of an existing novel.

You are the book's primary author.

This chapter will be accepted as the FINAL version.
There will be no separate AI editor, revision, or rewriting stage.

Write your strongest complete chapter on the first attempt.

The goal is compelling, immersive fiction that faithfully
executes the approved story plan while preserving your
individual creative voice.

TARGET LENGTH:
Approximately ${words} words, with reasonable flexibility.

Do not pad the chapter to meet the target.
Do not rush or omit important scenes to keep it short.

AUTHORITATIVE REFERENCES:

1. STORY BIBLE
Defines established characters, world rules, relationships,
major plot constraints, narrative perspective, and tense.

2. CURRENT CHAPTER PLAN
Defines the required developments that must occur now.

3. ACCEPTED STORY HISTORY
Defines what has actually happened and what characters know.

4. BOOK SO FAR
Contains the full manuscript written up to this point, in order,
so the current chapter can continue the cumulative story without
forgetting earlier developments, emotional arcs, or world details.

5. FUTURE MILESTONES
Defines important events reserved for later chapters.

6. PREMISE COMMITMENTS
Defines non-negotiable story promises, core mystery obligations,
causal mechanism rules, and ending payoffs that must remain active
throughout the manuscript.

These references are authoritative. Preserve established canon.

The CURRENT CHAPTER PLAN is the only plan that must be completed in this chapter.
Future milestones are reserved for later chapters; they are not current requirements.
The BOOK SO FAR is continuity, not a substitute for the current chapter's mandate.
The ACCEPTED STORY HISTORY is cumulative context, not a prompt to rehash earlier scenes.

==================================================
MOST IMPORTANT RULE: ACTUALLY WRITE THE EVENTS
==================================================

Every event in the current chapter's requiredEvents
must occur in the completed chapter.

Do not merely:
- Discuss the event.
- Prepare for the event.
- Promise the event will happen.
- Hint that the event may happen later.
- Summarize the event as if it occurred off-page.

Dramatize its important actions, dialogue, discoveries,
decisions, obstacles, and consequences.

If the chapter requires a confrontation, write the confrontation.

If it requires a revelation, reveal the information.

If it requires a character to travel to a location,
show or clearly establish the journey and arrival.

If it requires a relationship-changing decision,
show the choice and its meaningful consequences.

If it requires a battle to conclude, resolve that battle.

Do not replace a mandatory event with a thematically
similar but unrelated scene.

==================================================
NARRATIVE CONTINUITY
==================================================

This is an ongoing novel, not an independent short story.

Continue naturally from the full story so far, building on the
cumulative arc, relationships, and findings established in earlier
chapters.

Respect:
- Established character knowledge.
- Previous decisions.
- Relationships and conflicts.
- Injuries and consequences.
- Locations and chronology.
- Discovered abilities and limitations.
- Completed emotional breakthroughs.
- Resolved or ongoing plot threads.
- Core premise commitments and unresolved mystery threads.

Never reintroduce a character or ability as unknown
if it was already clearly established.

Never repeat an earlier confrontation or discovery
as though it were happening for the first time.

If a character previously learned something meaningful,
their new decisions must reflect that experience.

A character may regress or struggle again, but such a
development needs a credible new cause and consequence.

==================================================
EACH CHAPTER MUST MOVE THE STORY FORWARD
==================================================

The chapter must accomplish a distinct narrative purpose.

Important scenes should change at least one of:
- What a character knows.
- What a character believes.
- What a character decides.
- What a character can or cannot do.
- What a character risks or stands to lose.
- How a relationship functions.
- What obstacles stand in the way.
- The situation surrounding the central conflict.

Do not spend the chapter repeatedly explaining a lesson
that readers have already witnessed.

Do not repeat a planning conversation from the previous
chapter when the current plan requires execution.

A quiet or introspective scene is valuable when it creates
a meaningful choice, realization, conflict, or consequence.

==================================================
SCENE WRITING
==================================================

Write fully realized scenes, not expanded plot summaries.

Important scenes should have:
- A clear immediate situation.
- Characters with believable intentions.
- Something that complicates those intentions.
- Meaningful action, interaction, or discovery.
- Consequences that lead naturally to what follows.

Show significant moments through concrete behavior,
dialogue, and unfolding events.

Avoid simply announcing:
"They realized they were stronger together."

Instead, let their actions reveal how their relationship
changes the outcome.

Do not explain the same emotional insight repeatedly.

Allow scenes to breathe when the emotional or dramatic
importance warrants it.

Use natural transitions between locations and scenes.

==================================================
PROSE QUALITY
==================================================

Write vivid, polished prose appropriate to the genre.

Favor precise, meaningful description over decorative language.

Avoid:
- Excessive metaphors.
- Recycled phrases.
- Constant references to hearts, warmth, shadows,
  light, hope, or similar motifs without new meaning.
- Repeated descriptions of the same emotion.
- Generic motivational dialogue.
- Unnecessary explanations of established themes.
- Artificially inspirational chapter endings.
- Formulaic paragraphs that restate previous paragraphs.

Recurring imagery is welcome when it evolves or
serves a specific narrative purpose.

Vary sentence length and paragraph rhythm.

Use sensory details to establish distinctive places
and actions rather than simply decorating prose.

==================================================
CHARACTER WRITING
==================================================

Characters must feel like distinct individuals.

Give them different:
- Motivations.
- Beliefs.
- Fears.
- Methods of solving problems.
- Emotional reactions.
- Speaking styles.
- Priorities.

Do not have every character provide variations
of the same supportive advice.

Allow believable disagreement, miscommunication,
humor, selfishness, hesitation, and conflicting goals.

Supporting characters should contribute through
meaningful choices and actions.

The protagonist should exercise agency appropriate
to the story and current circumstances.

Develop relationships through what people do for,
with, or against one another, not merely through
statements about friendship or loyalty.

==================================================
DIALOGUE
==================================================

Make conversations natural and purposeful.

Dialogue should reveal character, create tension,
change a relationship, advance a decision, or
communicate relevant information.

Avoid exchanges where multiple characters simply
agree with each other in increasingly inspirational language.

Use subtext and disagreement when appropriate.

Avoid repeated speeches explaining the power
of courage, friendship, unity, or determination.

Let characters communicate according to their
individual personalities and circumstances.

==================================================
STORY STRUCTURE
==================================================

Follow the approved sequence of required events.

You may create additional minor scenes, dialogue,
and supporting details when they improve the chapter.

Do not introduce major contradictions or unplanned
resolutions.

Do not reveal future milestones prematurely.

Do not drop, contradict, or quietly forget the manuscript's
core premise commitments.

Do not invent convenient powers, information, or
resources that bypass established obstacles.

The chapter must end in the situation established
by its approved outline.

The ending should feel earned, not mechanically
constructed to set up the next chapter.

Avoid unnecessarily recapping the events or themes
of the entire chapter in its final paragraphs.

==================================================
NARRATIVE PERSPECTIVE AND TENSE
==================================================

Follow the story bible's established narration rules.

Keep the same point of view and tense unless
the approved plan explicitly permits a change.

Maintain narrative voice consistently.

==================================================
FINAL AUTHOR SELF-CHECK
==================================================

Before returning your chapter, silently verify:

1. Every required event actually happens.
2. The chapter follows the established story.
3. No significant earlier scene is unnecessarily repeated.
4. Character development remains cumulative.
5. The chapter introduces meaningful new developments.
6. The dialogue sounds distinct and natural.
7. Major events are dramatized, not summarized away.
8. The approved chapter ending is reached.
9. Reserved future milestones remain intact.
10. The chapter reads like finished fiction.
11. The chapter either advances or preserves the core premise threads.

If any requirement is missing, correct the draft
internally before producing your final response.

OUTPUT:
Return ONLY the complete prose of Chapter ${number}.

No chapter title.
No outline.
No commentary.
No revision notes.
No checklist.
No word count.
No explanation.

STORY BIBLE:
${bible}

AUTHORITATIVE CURRENT CHAPTER PLAN:
${asText(chapterOutline)}

FUTURE EVENTS RESERVED FOR LATER CHAPTERS:
${asText(context.futureMilestones || [])}

PREMISE COMMITMENTS:
${asText(context.premiseCommitments || {})}

CUMULATIVE PLOT MILESTONES:
${asText(context.completedMilestones || [])}

ACTIVE UNRESOLVED MYSTERIES:
${asText(context.activeMysteries || [])}

ACCEPTED STORY HISTORY:
${storySoFarSummary ||
  "This is Chapter 1. No previous story events exist."}

BOOK SO FAR:
${bookSoFar ||
  "This is Chapter 1. No previous story exists."}
`;
}


// ------------------------------------------------------------
// 9. REVIEW CHAPTER X
// ------------------------------------------------------------

function prompt9ReviewChapterX(
  bible,
  chapterOutline,
  chapterNumber,
  chapter,
  context = {}
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
- Duplicate scenes or retellings of earlier chapter beats
- Repeated character development, emotional breakthroughs, or conflict resolutions
- Chapter-to-chapter resets that undo prior progress without a new consequence

IMPORTANT:
Separate structural correctness from creative quality; ratings cannot override validation failures.
Use exact short excerpts; never invent quotations, line references or page numbers.
Do not request more reflection on an already completed emotional breakthrough.
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

AUTHORITATIVE CURRENT CHAPTER PLAN:
${asText(chapterOutline)}

ACCEPTED HISTORY, PREVIOUS CHAPTER AND RESERVED FUTURE MILESTONES:
${asText(context)}

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
  arrayOfFeedback,
  context = {}
) {
  const number = chapterLabel(chapterNumber);

  return `
YOUR TASK:
Rewrite the provided chapter into a stronger, polished final draft.
Priority order: restore missing required events; correct outline deviations; fix continuity; remove duplicate scenes; retain cumulative character growth; improve transitions and pacing; then dialogue and prose.
Regenerate from the assigned plan if the draft fundamentally deviates. Structural failures are mandatory corrections, regardless of editorial ratings.
Preserve the bible tense and POV unless the approved plan explicitly changes them.
Target approximately ${Number(process.env.CHAPTER_WORDS) || 3000} words with natural flexibility.

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
- Remove repeated scenes, repeated emotional discoveries, or duplicate confrontations
  that do not evolve the story.
- Ensure the chapter advances the story rather than rephrasing the previous chapter.

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

AUTHORITATIVE CURRENT CHAPTER PLAN:
${asText(chapterOutline)}

ACCEPTED HISTORY, PREVIOUS CHAPTER AND RESERVED FUTURE MILESTONES:
${asText(context)}

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
  chapter,
  existingTitles = []
) {
  const number = chapterLabel(chapterNumber);

  return `
You are a professional literary editor specializing in memorable titles.

Create ONE distinctive title for Chapter ${number}.

The title must reflect this chapter's actual content,
rather than merely repeating the novel's broad themes.

TITLE REQUIREMENTS:

- Be concise, memorable, and evocative.
- Match the genre and author's artistic style.
- Reflect a meaningful event, image, discovery,
  location, decision, or emotional turning point.
- Feel distinctive within the complete novel.
- Avoid revealing important spoilers unnecessarily.
- Avoid generic fantasy or dramatic phrasing.

TITLE VARIETY:

Compare your proposed title with every existing chapter title.

Avoid:
- Repeating the same opening word.
- Reusing the same main nouns.
- Rearranging words from an existing title.
- Repeating the same grammatical template.
- Repeatedly relying on broad symbolic terms.
- Creating titles that could describe almost any chapter.

For example, do not generate a sequence such as:
"Threads of Light"
"Threads of Unity"
"Threads of Shadow"

Prefer specificity when appropriate.

A meaningful object, place, choice, or incident from
the actual chapter may provide a stronger title than
an abstract description of its themes.

Choose a title that distinguishes this chapter from
the others while remaining artistically appropriate.

Before responding, internally consider several
different candidates and choose the strongest.

OUTPUT:
Return ONLY the raw chapter title.

No chapter number.
No quotation marks.
No markdown.
No explanation.
No alternatives.

EXISTING CHAPTER TITLES:
${asText(existingTitles)}

STORY BIBLE:
${bible}

CHAPTER OUTLINE:
${asText(chapterOutline)}

COMPLETED CHAPTER:
${chapter}
`;
}

// ------------------------------------------------------------
// 12. GENERATE BOOK TITLE
// ------------------------------------------------------------

function prompt12WriteBookName(bible, chapterOutline) {
  return `
Create the strongest possible raw title for this book.

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
Return only the raw title text itself.
No chapter prefix, no "Book Title:" label, no markdown, no bold,
no quotation marks, no subtitle formatting, no numbering,
no explanations, and no alternative suggestions.

STORY BIBLE:
${bible}

COMPLETE CHAPTER OUTLINE:
${asText(chapterOutline)}
`;
}

// ------------------------------------------------------------
// 13. GENERATE BOOK COVER ART PROMPT
// ------------------------------------------------------------

function prompt14WriteBookDescription(
  bible,
  chapterOutline,
  title,
  chapterNames = []
) {
  return `
Write the back-cover description for this finished novel.

PURPOSE:
Create a short marketing blurb that makes readers want to open the book.
This should sound like a polished jacket description, not a summary of the writing process.

REQUIREMENTS:
- Highlight the protagonist, central tension, and emotional stakes.
- Capture the book's tone, atmosphere, and broader themes.
- Give a sense of the story arc without revealing the ending.
- Keep it vivid, readable, and commercial in tone.
- Aim for one compact paragraph of around 90-170 words.
- Keep the language clean and immersive.
- Do not mention the writing process, AI, outlines, or chapters.

OUTPUT:
Return only the paragraph text.
No heading, no labels like "Book Description:", no markdown, no bullets,
no quotes, no chapter references, and no extra commentary.

BOOK TITLE:
${title}

CHAPTER TITLES:
${(chapterNames.length ? chapterNames.join(" | ") : "Not yet finalized")}

STORY BIBLE:
${bible}

COMPLETE CHAPTER OUTLINE:
${asText(chapterOutline)}
`;
}

function prompt13MakeBookCover(
  bible,
  title,
  authorsName,
  chapterArray
) {
  const compactBible = truncatePromptText(bible, 3500);
  const compactManuscript = truncatePromptText(asText(chapterArray), 5000);

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
${compactBible}

BOOK TITLE:
${title}

AUTHOR NAME:
${authorsName}

FULL MANUSCRIPT:
${compactManuscript}
`;
}

function prompt15ExtractPremiseCommitments(description, plotline, bible, chapterOutline = "") {
  return `
Extract the manuscript's non-negotiable premise commitments.

Return ONLY JSON with this shape:
{
  "essentialPlotPromises": ["concrete promise the story must deliver"],
  "centralMystery": "single-sentence core mystery or dramatic question",
  "majorReveals": [
    {
      "reveal": "what truth is revealed",
      "expectedPhase": "setup|middle|climax|ending",
      "whyItMatters": "why this reveal is structurally necessary"
    }
  ],
  "causalRules": ["mechanism or rule that must remain causally consistent"],
  "requiredEndingPayoffs": ["specific payoff that must be shown on-page by the ending"]
}

Rules:
- Keep entries concrete and testable.
- Prefer short, explicit statements.
- No stylistic advice.
- No commentary outside JSON.

ORIGINAL DESCRIPTION:
${description}

APPROVED PLOTLINE:
${plotline}

STORY BIBLE:
${bible}

CURRENT CHAPTER OUTLINE:
${asText(chapterOutline)}
`;
}


module.exports = {
  prompt1Plotline,
  prompt2RatePlotline,
  prompt3StoryBible,
  prompt4RateStoryBible,
  prompt5WriteChapterOutline,
  prompt6RateChapterOutline,
  prompt7ImproveChapterOutline,
  prompt8WriteChapterX,
  prompt9ReviewChapterX,
  prompt10ImproveChapterX,
  prompt11WriteChapterName,
  prompt12WriteBookName,
  prompt13MakeBookCover,
  prompt14WriteBookDescription,
  prompt15ExtractPremiseCommitments,
};

