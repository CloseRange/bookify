const {test}=require('node:test');
const assert=require('node:assert/strict');
const speak=require('./author_speak'), io=require('./book_io');
const plans=[
 {number:1,purpose:'Find a key',start:'Market',requiredEvents:['Buy the brass key'],ending:'Leave market',introductions:['Mira'],optionalDetails:[]},
 {number:2,purpose:'Share memories',start:'River',requiredEvents:['Reveal childhood fears by the river'],ending:'Agree to travel together',introductions:[],optionalDetails:[]},
 {number:3,purpose:'Open the tower',start:'Tower',requiredEvents:['Unlock the tower'],ending:'Enter tower',introductions:[],optionalDetails:[]},
];
const prose=[
 'Mira paid the merchant three coins for a brass key. She left the market carrying her purchase.',
 'Beside the river, Jules confessed his childhood fear of drowning. Mira promised to accompany him north.',
 'At dawn the travelers reached the tower. The brass key unlocked its iron door and they stepped inside.',
];
const facts=['Mira bought a brass key','Jules revealed his childhood fear','The travelers entered the tower'];
const scenarios = [
 { variant:'distinct', enforceEnv:'1' },
 { variant:'exact', enforceEnv:'1' },
 { variant:'near', enforceEnv:'1' },
 { variant:'invalid memory', enforceEnv:'1' },
 { variant:'save failure', enforceEnv:'1' },
 { variant:'exact', enforceEnv:undefined },
 { variant:'near', enforceEnv:undefined },
 { variant:'invalid memory', enforceEnv:undefined },
];
for(const { variant, enforceEnv } of scenarios) test(`single-pass three-chapter integration: ${variant} (BOOKIFY_ENFORCE_INTERNAL_VALIDATION=${String(enforceEnv)})`,async()=>{
 const originals={...speak}, originalsIO={...io}, old=process.env.CHAPTERS;
 const oldInternalValidation = process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION;
 const oldStoryStateValidation = process.env.BOOKIFY_ENFORCE_STORY_STATE;
 const saved=[], written=[], extracted=[], diagnostics=[];
 const oldLog=console.log;console.log=(...args)=>diagnostics.push(args.join(' '));
 process.env.CHAPTERS='3';
 if (enforceEnv === undefined) delete process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION;
 else process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION=enforceEnv;
 process.env.BOOKIFY_ENFORCE_STORY_STATE='1';
 speak.rateBookText=async()=>8;speak.generateImage=async()=>Buffer.from('image');
 speak.generateResponse=async(id,p,options)=>{
  assert.doesNotMatch(p,/structural continuity validator|Review Chapter \d+ as a finished draft|Only the entire revised prose/);
  if(p.includes('Create a complete, detailed outline')||p.includes('Return ONLY the complete revised chapter outline')||p.includes('Return ONLY the complete structured chapter outline')) return JSON.stringify({chapters:plans});
  if(p.includes('Extract story state from the final prose')) {
   const number=Number(/final prose of Chapter (\d+)/.exec(p)[1]);extracted.push(number);
   if(variant==='invalid memory' && number===2) return '{invalid';
   const text=prose[number-1];assert.ok(p.endsWith(text));
   return JSON.stringify({number,ending:text.split('. ').at(-1),currentSituation:text.split('. ').at(-1),completedEvents:[{description:facts[number-1],evidence:text.split('. ')[0]}],developments:[{category:'knowledge',subject:'Mira',fact:facts[number-1],evidence:text.split('. ')[0]}]});
  }
  if(p.includes('professional novelist writing Chapter')) {
   const number=Number(/novelist writing Chapter (\d+)/.exec(p)[1]);written.push(number);
  const plan=JSON.parse(p.split('AUTHORITATIVE CURRENT CHAPTER PLAN:\n')[1].split('\n\nFUTURE EVENTS')[0]);assert.deepEqual(plan,plans[number-1]);
  const future=JSON.parse(p.split('FUTURE EVENTS RESERVED FOR LATER CHAPTERS:\n')[1].split('\n\nPREMISE COMMITMENTS')[0]);assert.deepEqual(future.map(x=>x.number),plans.slice(number).map(x=>x.number));
   const history=JSON.parse(p.split('ACCEPTED STORY HISTORY:\n')[1].split('\n\nBOOK SO FAR')[0]);assert.equal(history.length,number-1);
  for(let i=0;i<number-1;i++) {
   if (variant==='distinct') assert.equal(history[i].developments[0].fact,facts[i]);
   else assert.equal(typeof history[i].number, 'number');
  }
  let expectedBookSoFar = 'This is Chapter 1. No previous story exists.';
  if (number > 1) {
   expectedBookSoFar = prose[number-2];
   if (number===3 && variant==='exact') expectedBookSoFar = prose[0];
   if (number===3 && variant==='near') expectedBookSoFar = `${prose[0]} Quietly.`;
  }
   assert.equal(p.split('BOOK SO FAR:\n')[1].trim(), expectedBookSoFar);
   options?.onCacheMetadata({hit:false});
   if(number===2&&variant==='exact') return prose[0];
   if(number===2&&variant==='near') return prose[0]+' Quietly.';
   return prose[number-1];
  }
  if(p.includes('Create ONE distinctive title')||p.includes('Create a memorable raw title')) return 'A Chapter Title';
  return 'Mock narrative response';
 };
 for(const key of Object.keys(io)) if(key!=='readMeta') io[key]=()=>{};
 io.makeBookFolder=()=> 'mock-book';
 io.addChapter=(uuid,number,title,text,state)=>{
  let expectedText = prose[number-1];
  if (variant==='exact' && number===2) expectedText = prose[0];
  if (variant==='near' && number===2) expectedText = `${prose[0]} Quietly.`;
  assert.equal(text,expectedText);assert.equal(state.chapters.length,number);
  if(variant==='save failure' && number===2) throw new Error('Mock filesystem write failure');
  saved.push(number);
 };
 const modulePath=require.resolve('./write_book');delete require.cache[modulePath];
 try {
  const run=require('./write_book').writeBook('An adventure');
  if(variant==='save failure') {
   await assert.rejects(run,/Mock filesystem write failure/);
    assert.deepEqual(saved,[1]);assert.ok(written.length>=2);assert.ok(extracted[0]===1 && extracted.includes(2));
  }
  else {
   await run;
   assert.deepEqual(saved,[1,2,3]);
    assert.ok(written.length>=3);
    assert.equal(written[0],1);
    assert.equal(written.at(-1),3);
   assert.ok(extracted[0]===1);
   assert.ok(extracted.includes(2));
   assert.equal(extracted.at(-1),3);
  }
  const debug=diagnostics.filter(x=>x.startsWith('[chapter-debug]')).map(x=>JSON.parse(x.slice('[chapter-debug] '.length)));
  assert.equal(debug.length,variant==='save failure'?2:3);
  assert.equal(debug.at(-1).saved,variant!=='save failure');
  assert.equal(debug[0].cacheHit,false);
  if (variant==='exact' || variant==='near') {
    assert.match(String(debug[1].duplicateWarning || ''), /Duplicate chapter/);
  }
  if (variant==='invalid memory') {
   assert.match(String(debug[1].storyStateWarning || ''), /Story-state extraction warning/);
  }
  if (variant==='exact' || variant==='near') {
   assert.ok((debug[1].generationAttempts || 1) > 1);
  }
 } finally {
  console.log=oldLog;Object.assign(speak,originals);Object.assign(io,originalsIO);delete require.cache[modulePath];
  if(old===undefined) delete process.env.CHAPTERS;else process.env.CHAPTERS=old;
    if(oldInternalValidation===undefined) delete process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION; else process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION=oldInternalValidation;
    if(oldStoryStateValidation===undefined) delete process.env.BOOKIFY_ENFORCE_STORY_STATE; else process.env.BOOKIFY_ENFORCE_STORY_STATE=oldStoryStateValidation;
 }
});

test('completion-first pipeline finishes despite repeated noncritical failures', async () => {
 const originals={...speak}, originalsIO={...io}, old=process.env.CHAPTERS;
 const oldInternalValidation = process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION;
 const saved=[];
 const chapterDiagnostics={};
 let pipelineDiagnostics=null;
 let chapter2GenerationCalls=0;
 let chapter2ExtractionCalls=0;
 let structureRepairCalls=0;

 const badPlans=[
  {number:1,purpose:'Same purpose',start:'Start',requiredEvents:['Event A happens'],ending:'End A',introductions:['Mira'],optionalDetails:[]},
  {number:2,purpose:'Same purpose',start:'Start',requiredEvents:['Event A happens again'],ending:'End B',introductions:[],optionalDetails:[]},
  {number:3,purpose:'Same purpose',start:'Start',requiredEvents:['Event A happens once more'],ending:'End C',introductions:[],optionalDetails:[]},
 ];
 const chapter1='Mira crossed the square and accepted the map. Night fell over the market.';
 const chapter3='At dawn Mira and Jules opened the archive and found the ledger. They left with proof.';

 process.env.CHAPTERS='3';
 process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION='1';
 speak.rateBookText=async()=>8;
 speak.generateImage=async()=>{ throw new Error('image offline'); };
 speak.generateResponse=async(id,prompt,options={})=>{
  if(prompt.includes('Create a complete, detailed outline')) return JSON.stringify({chapters:badPlans});
  if(prompt.includes('Return ONLY the complete revised chapter outline') || prompt.includes('Return ONLY the complete structured chapter outline')) {
   structureRepairCalls++;
   return JSON.stringify({chapters:badPlans});
  }
  if(prompt.includes('professional novelist writing Chapter')) {
   const number=Number(/novelist writing Chapter (\d+)/.exec(prompt)[1]);
   options?.onCacheMetadata?.({hit:false});
   if(number===1) return chapter1;
   if(number===2) { chapter2GenerationCalls++; return chapter1; }
   return chapter3;
  }
  if(prompt.includes('Extract story state from the final prose')) {
   const number=Number(/final prose of Chapter (\d+)/.exec(prompt)[1]);
   if(number===2) { chapter2ExtractionCalls++; return '{invalid'; }
   if(number===1) return JSON.stringify({
    number:1,
    ending:'The chapter closes with Mira back in the market.',
    endingEvidence:'Night fell over the market.',
    currentSituation:'Mira now has the map.',
    currentSituationEvidence:'accepted the map',
    completedEvents:[{description:'Mira accepted the map',evidence:'accepted the map'}],
    developments:[{category:'items',subject:'map',fact:'The map is now in Mira\'s possession',evidence:'accepted the map'}],
   });
   return JSON.stringify({
    number:3,
    ending:'The team departs with documentary proof.',
    endingEvidence:'They left with proof.',
    currentSituation:'The archive evidence is secured.',
    currentSituationEvidence:'found the ledger',
    completedEvents:[{description:'They found the ledger',evidence:'found the ledger'}],
    developments:[{category:'knowledge',subject:'team',fact:'They now hold proof from the archive',evidence:'left with proof'}],
   });
  }
  if(prompt.includes('Create ONE distinctive title')) return 'Title';
  if(prompt.includes('Create a memorable raw title')) return 'Book Title';
  if(prompt.includes('back-cover description')) return 'A determined pair follows clues and uncovers the truth.';
  return 'Mock narrative response';
 };

 for(const key of Object.keys(io)) if(key!=='readMeta') io[key]=()=>{};
 io.makeBookFolder=()=> 'mock-book';
 io.addChapter=(uuid,number,title,text,state,validation,diagnostics)=>{
  saved.push(number);
  chapterDiagnostics[number]=diagnostics;
  assert.equal(state.chapters.length,number);
  assert.ok(text.trim().length>0);
 };
 io.setPipelineDiagnostics=(uuid,diagnostics)=>{ pipelineDiagnostics=diagnostics; };

 const modulePath=require.resolve('./write_book');delete require.cache[modulePath];
 try {
  await require('./write_book').writeBook('A completion-first resilience test');
  assert.deepEqual(saved,[1,2,3]);
  assert.ok(chapter2GenerationCalls>=3);
  assert.ok(chapter2ExtractionCalls>=3);
  assert.equal(chapterDiagnostics[2].memoryFallbackUsed,true);
  assert.ok((chapterDiagnostics[2].acceptedWarnings || []).length>0);
  assert.ok(structureRepairCalls>=2);
  assert.ok((pipelineDiagnostics?.outline?.structureWarnings || []).length>0);
 } finally {
  Object.assign(speak,originals);Object.assign(io,originalsIO);delete require.cache[modulePath];
  if(old===undefined) delete process.env.CHAPTERS;else process.env.CHAPTERS=old;
  if(oldInternalValidation===undefined) delete process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION; else process.env.BOOKIFY_ENFORCE_INTERNAL_VALIDATION=oldInternalValidation;
 }
});
