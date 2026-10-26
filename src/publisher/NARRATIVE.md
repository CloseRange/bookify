# Single-pass chapter generation

Plotline voting, story-bible voting, outline reviews and outline improvement are
unchanged. The approved outline uses the existing JSON schema and is frozen after
parsing. The main author writes each chapter once. There are no chapter reviews,
prose revisions, automatic regeneration or final AI acceptance audit in writeBook.
Legacy validation helpers remain exported for compatibility; the pipeline does
not invoke them. NARRATIVE_VALIDATION and CHAPTER_MAX_ATTEMPTS do not govern this
single-pass flow.

## Findings from Prism of Promises

The saved book 8484dae7-faeb-4c1c-9376-a3a7d95f285e has no storyState field.
Its Chapter 6 and 7 approved plans are different (Veil origins versus riverside
memories), but the prose repeats the forest confrontation. The two prose texts
match separate cache entries, fec75a51924c… and bff07d0acdb3…, with different
creation times. The current exact-hash cache does not substitute responses by
author bucket. Saved outputs alone cannot reconstruct the historical prompts.

The inspected loop indexes plans[number - 1] and previous prose[number - 2]
correctly. It did, however, shorten previous prose to its opening and tail, and
its local state builder only recognized events when outline wording appeared
verbatim. That misses natural paraphrases and many unplanned developments.
Character-name matches also incorrectly implied a new introduction. Its word-set
similarity could mistake shared vocabulary for copied passages. Diagnostics
reported zero for all sub-threshold comparisons and logged saved:true before IO.

These findings support model repetition combined with inadequate memory and
safeguards, rather than a demonstrated plan-selection, cache or file-number bug.
The historical generation's exact inputs are unavailable, so that distinction
cannot be proven retroactively.

## Memory and context

contextFor asserts chapter selection and sequential history and preserves the
full immediately preceding chapter. Writing prompts separate current mandatory
plan, future milestones, cumulative actual history, and previous prose. Existing
instructions require performing events, stopping at the planned ending, and not
repeating completed developments.

After duplicate checks, a separate extraction request reads only final prose,
never the outline. It must distinguish dreams, speculation and intentions from
actual events. Memory includes 1–8 completed events, up to 16 categorized
facts (locations, knowledge/revelations, relationships, abilities/limitations,
consequences, conflicts, decisions, breakthroughs and other actual changes), and
ending/current-situation excerpts from the final paragraph. JSON shape, counts,
lengths, chapter identity, categories and quotations are validated locally.
Invalid extraction stops with an error; it never rewrites prose or saves inferred
outline events as facts. There is no automatic extraction retry.

History is append-only; no earlier chapter is discarded or summarized again.
The persisted ledger retains evidence. Writing context includes all concise
facts and completed events, omitting redundant evidence quotations for
developments. Earlier facts may be superseded by later entries; read in order.
Evidence verification proves that a quote exists, not that a model interpreted
it correctly. Semantic extraction can still misinterpret events. Full previous
prose plus accumulating history can eventually exceed model context limits;
there is currently no silent truncation or automatic history compaction.

## Duplicate rejection and diagnostics

Formatting, case and punctuation are normalized. Five-word sequences measure
copied prose instead of shared names and themes. Reject normalized equality,
at least 80% matching sequence coverage in both chapters, at least 50% coverage
of either chapter when both have 120+ words, or a continuous copied passage of
100+ words. Comparisons cover all prior chapters. These conservative thresholds
may reject deliberately repeated long quotations and cannot reliably detect
semantic paraphrases. A rejection identifies chapter numbers, similarity,
coverage and longest passage and occurs before extraction, title or save.

For the saved Chapters 6 and 7, this detects 88.3% mutual sequence coverage,
93.9% coverage of Chapter 7, and a continuous 430-word copied passage. This score
uses a different metric from the originally reported textual similarity.

Each chapter logs requested/selected numbers, event count, previous chapter
number and context length, story context length, word count, cache hit/miss
(null when unavailable), comparisons against all earlier chapters, and saved
status. The record is emitted even on generation, extraction or save failure;
saved becomes true only after IO succeeds. Prompts, prose and secrets are omitted.
Cache metadata uses a per-call callback rather than shared mutable last-call
metadata. Cache identity already covers full prompt, author/profile and model;
there are no additional sampling settings in the current request.

Book IO checks sequential numbering, state evidence and existing chapter files.
Writes remain ordinary filesystem writes, not a crash-atomic transaction. Existing
books are not modified or repaired.

Run mocked/local checks without paid API calls:

    CHAPTERS=10 node --test src/publisher/*.test.js
