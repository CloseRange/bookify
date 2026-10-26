const assert = require('node:assert/strict');
process.env.CHAPTERS ||= '10';
process.env.BOOKIFY_ENFORCE_STORY_STATE = '1';
const prompts = require('./prompts');
const bookIO = require('./book_io');
const { sanitizeTitle } = require('./write_book');

function checkPromptTexts() {
  const outlinePrompt = prompts.prompt5WriteChapterOutline('plotline', 'story bible');
  const chapterPrompt = prompts.prompt8WriteChapterX('story bible', 'chapter outline', 1, '', '', 5, 10);
  const reviewPrompt = prompts.prompt9ReviewChapterX('story bible', 'chapter outline', 1, 'chapter draft');
  const chapterTitlePrompt = prompts.prompt11WriteChapterName('story bible', 'chapter outline', 1, 'chapter draft');
  const bookTitlePrompt = prompts.prompt12WriteBookName('story bible', 'chapter outline');
  const bookDescriptionPrompt = prompts.prompt14WriteBookDescription('story bible', 'chapter outline', 'Book Title', ['One', 'Two']);

  assert.match(
    outlinePrompt,
    /CORE REQUIREMENT: NARRATIVE PROGRESSION/i,
    'Outline prompt should explicitly forbid repeated scenes and require progression.'
  );

  assert.match(
    chapterPrompt,
    /Continue naturally from the full story so far|BOOK SO FAR/i,
    'Chapter prompt should treat the chapter as a continuation of the full manuscript so far and reject retellings.'
  );

  assert.match(
    reviewPrompt,
    /duplicate scenes|repeated character development|repeated emotional breakthroughs|continuity/i,
    'Review prompt should specifically look for repeated scenes and duplicated character arcs.'
  );

  assert.match(
    chapterTitlePrompt,
    /raw title text|No chapter number|No quotation marks|No markdown|No chapter prefix|Do not include a chapter number/i,
    'Chapter-title prompt should insist on raw title text only.'
  );

  assert.match(
    bookTitlePrompt,
    /raw title text|No quotation marks|No subtitles|No markdown|No title label|No chapter prefix/i,
    'Book-title prompt should insist on raw book-title text only.'
  );

  assert.match(
    bookDescriptionPrompt,
    /back-cover description|No heading|No markdown|no labels|Return only the paragraph text/i,
    'Book-description prompt should enforce a plain paragraph and reject formatting labels.'
  );
}

function checkTitleSanitization() {
  assert.equal(sanitizeTitle('**Chapter 3: The Glass Door**'), 'The Glass Door');
  assert.equal(sanitizeTitle('Chapter 7: Ashes Beneath the Oak'), 'Ashes Beneath the Oak');
  assert.equal(sanitizeTitle('  "The Quiet Harbor"  '), 'The Quiet Harbor');
  assert.equal(sanitizeTitle('# Title: Lanterns in Winter'), 'Lanterns in Winter');
}

function checkBookMetadataPersistence() {
  const uuid = bookIO.makeBookFolder();
  try {
  bookIO.setTitle(uuid, 'Metadata Title');
  bookIO.setBookDescription(uuid, 'Original prompt text');
  bookIO.setStoryBible(uuid, 'Story bible text');
  bookIO.setChapterOutline(uuid, 'Outline text');
  bookIO.setDescription(uuid, 'Back-cover description');

  const { meta } = bookIO.readMeta(uuid);
  assert.equal(meta.originalDescription, 'Original prompt text');
  assert.equal(meta.bookDescription, 'Original prompt text');
  assert.equal(meta.storyBible, 'Story bible text');
  assert.equal(meta.chapterOutline, 'Outline text');
  assert.equal(meta.description, 'Back-cover description');
  assert.equal(Object.prototype.hasOwnProperty.call(meta, 'descritpion'), false);
  const text='Mira opened the gate. She walked outside.';
  const entry={number:1,ending:'She walked outside.',currentSituation:'She walked outside.',completedEvents:[{description:'Mira opened the gate',evidence:'Mira opened the gate.'}],developments:[]};
  const state={version:1,chapters:[entry]};
  bookIO.addChapter(uuid,1,'The Gate',text,state);
  const persisted=bookIO.readMeta(uuid).meta;
  assert.deepEqual(persisted.storyState,state);
  assert.equal(persisted.chapters[0].file,'001.md');
  const fs=require('node:fs'),path=require('node:path');
  const chapterPath=path.join(path.dirname(bookIO.readMeta(uuid).metaPath),'001.md');
  assert.equal(fs.readFileSync(chapterPath,'utf8'),text);
  assert.throws(()=>bookIO.addChapter(uuid,1,'Replacement','different text',state),/sequential/);
  const bad={version:1,chapters:[entry,{...entry,number:2,completedEvents:[{description:'Invented',evidence:'Not in prose'}]}]};
  assert.throws(()=>bookIO.addChapter(uuid,2,'Bad memory',text,bad),/Unsupported story-state evidence/);
  assert.equal(bookIO.readMeta(uuid).meta.chapters.length,1);
  assert.equal(fs.existsSync(path.join(path.dirname(chapterPath),'002.md')),false);

  } finally {
    require('node:fs').rmSync(require('node:path').dirname(bookIO.readMeta(uuid).metaPath), {recursive:true});
  }
}

checkPromptTexts();
checkTitleSanitization();
checkBookMetadataPersistence();
console.log('continuity guard checks passed');
