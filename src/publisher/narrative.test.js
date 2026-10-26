const {test} = require('node:test');
const assert = require('node:assert/strict');
const n = require('./narrative');
const prompts = require('./prompts');
const plan = {number:1, purpose:'discover protection', start:'Art District', requiredEvents:['Battle shadow creature', 'Discover shield'], ending:'Return home', introductions:[], optionalDetails:[]};
const chapter = 'Lyra fought the creature. A shield rose. She returned home.';
const good = () => ({events:[{index:0,status:'dramatized',evidence:'fought the creature'},{index:1,status:'dramatized',evidence:'A shield rose'}], ending:{met:true,evidence:'returned home'},issues:[],developments:[{category:'abilities',subject:'Lyra',fact:'Discovered shield',evidence:'A shield rose'}]});
test('mandatory omissions and summarized scenes block acceptance even without issues', () => {
  for (const status of ['missing','summarized','contradicted']) {
    const r=good(); r.events[1]={index:1,status,evidence:'No shield scene'};
    assert.equal(n.validateReport(r,plan,chapter).passed,false);
  }
});
for (const [category,description] of [
  ['repetition','Repeats previous chapter battle without new development'],
  ['introduction','Mira appears before chapter four introduction'],
  ['bible','Lyra flies despite bible forbidding flight'],
  ['resolution','Final chapter assumes Eclipsor defeated without any actual defeat']
]) test(`${category} definite major violation blocks a positive report`, () => {
  const r=good(); r.issues.push({category,description,severity:'major',certainty:'definite',evidence:'A shield rose',correction:'Restore the approved events and canon'});
  assert.equal(n.validateReport(r,plan,chapter).passed,false);
});
test('unconventional style, callbacks and uncertain choices do not block valid events', () => {
  const r=good();r.issues.push({category:'style',severity:'minor',certainty:'possible',description:'Experimental fragments',evidence:'A shield rose',correction:'Optional'});
  assert.equal(n.validateReport(r,plan,chapter).passed,true);
});
test('invalid JSON, incomplete coverage and invented evidence are rejected', () => {
  assert.throws(()=>n.validateReport('no',plan,chapter));
  const r=good();r.events.pop();assert.throws(()=>n.validateReport(r,plan,chapter));
  const fake=good();fake.developments[0].evidence='invented';assert.throws(()=>n.validateReport(fake,plan,chapter));
});
test('whitespace-normalized evidence is accepted as real chapter text', () => {
  const chapterWithFormatting = 'Lyra fought the creature.\n\nA shield\nrose. She returned home.';
  const r = {
    events: [
      { index: 0, status: 'dramatized', evidence: 'fought the creature' },
      { index: 1, status: 'dramatized', evidence: 'A shield rose' }
    ],
    ending: { met: true, evidence: 'returned home' },
    issues: [],
    developments: [{ category: 'abilities', subject: 'Lyra', fact: 'Discovered shield', evidence: 'A shield rose' }]
  };
  assert.equal(n.validateReport(r, plan, chapterWithFormatting).passed, true);
});
test('one-based and out-of-order event indexes are normalized', () => {
  const r = {
    events: [
      { index: 2, status: 'dramatized', evidence: 'A shield rose' },
      { index: 1, status: 'dramatized', evidence: 'fought the creature' }
    ],
    ending: { met: true, evidence: 'returned home' },
    issues: [],
    developments: [{ category: 'abilities', subject: 'Lyra', fact: 'Discovered shield', evidence: 'A shield rose' }]
  };
  const report = n.validateReport(r, plan, chapter);
  assert.equal(report.passed, true);
  assert.deepEqual(report.events.map(e => e.index), [0, 1]);
});
test('status synonyms are accepted and normalized', () => {
  const r = {
    events: [
      { index: 0, status: 'present', evidence: 'fought the creature' },
      { index: 1, status: 'met', evidence: 'A shield rose' }
    ],
    ending: { met: true, evidence: 'returned home' },
    issues: [],
    developments: [{ category: 'abilities', subject: 'Lyra', fact: 'Discovered shield', evidence: 'A shield rose' }]
  };
  const report = n.validateReport(r, plan, chapter);
  assert.equal(report.passed, true);
  assert.deepEqual(report.events.map(e => e.status), ['dramatized', 'dramatized']);
});
test('failed chapter is repaired and validated again; only accepted result updates immutable history', async () => {
  let checks=0, repairs=0;
  const bad=good();bad.events[1].status='missing';
  const before={version:1,chapters:[]};
  const result=await n.ensureValid({draft:chapter,plan,attempts:3,validate:async ()=>++checks===1?bad:good(),repair:async ()=>{repairs++;assert.equal(before.chapters.length,0);return chapter;}});
  assert.equal(checks,2); assert.equal(repairs,1);
  const after=n.acceptState(before,1,result.report);
  assert.equal(after.chapters.length,1);assert.equal(before.chapters.length,0);
  assert.throws(()=>n.acceptState(before,1,{passed:false}));
});
test('maximum attempts stops cleanly with unresolved issues and no state changes', async () => {
  let checks=0,repairs=0;
  const r=good();r.events[0].status='missing';
  await assert.rejects(n.ensureValid({draft:chapter,plan,attempts:2,validate:async()=>{checks++;return r;},repair:async()=>{repairs++;return chapter;}}), /Chapter 1 failed after 2.*Required event 1/);
  assert.equal(checks,2);assert.equal(repairs,1);
  for (const value of [0,-1,1.5,'NaN']) assert.throws(()=>n.maxAttempts(value));
});
test('invented validator evidence retries the unchanged chapter with feedback', async () => {
  let checks = 0;
  const result = await n.ensureValid({draft:chapter, plan, attempts:2,
    validate:async (actual, feedback) => {
      assert.equal(actual, chapter);
      if (++checks === 1) {
        const r = good(); r.events[1].evidence = 'An invented shield appeared'; return r;
      }
      assert.match(feedback[0].description, /required event 2.*An invented shield appeared/);
      return good();
    },
    repair:async () => assert.fail('Invalid validator reports must not rewrite prose')});
  assert.equal(result.chapter, chapter);
  assert.equal(checks, 2);
});
test('validator transport errors propagate without rewriting the chapter', async () => {
  await assert.rejects(n.ensureValid({draft:chapter, plan,
    validate:async () => {throw new Error('API unavailable');},
    repair:async () => assert.fail('Transport failures must not rewrite prose')}), /API unavailable/);
});
test('advisory review preserves prose and failed findings without blocking history', async () => {
  const r=good(); r.events[0].status='missing';
  const result=await n.reviewAdvisory({draft:chapter,plan,validate:async()=>r});
  assert.equal(result.chapter,chapter);
  assert.equal(result.report.passed,false);
  assert.equal(result.report.advisory,true);
  assert.equal(n.acceptState({version:1,chapters:[]},1,result.report).chapters.length,1);
});
test('advisory validator outages do not block and contribute no extracted facts', async () => {
  const result=await n.reviewAdvisory({draft:chapter,plan,validate:async()=>{throw new Error('offline');}});
  assert.equal(result.chapter,chapter);
  assert.equal(result.report.passed,false);
  assert.deepEqual(result.report.developments,[]);
  assert.match(result.report.failures[0].description,/offline/);
});
test('structured outline validates chapter count and sequential numbering',()=>{
  assert.deepEqual(n.parsePlans(JSON.stringify({chapters:[plan]}),1),[plan]);
  assert.throws(()=>n.parsePlans({chapters:[{...plan,number:2}]},1));
  assert.throws(()=>n.parsePlans({chapters:[plan]},2));
});
test('usable outline coercion always returns sequential chapter coverage',()=>{
  const malformed = '{"chapters":[{"number":2,"purpose":"Only chapter two","start":"late","requiredEvents":["Event"],"ending":"end","introductions":[],"optionalDetails":[]}]}';
  const plans = n.makeUsablePlans(malformed, 3);
  assert.equal(plans.length, 3);
  assert.deepEqual(plans.map(p => p.number), [1,2,3]);
  assert.ok(plans[0].requiredEvents.length >= 1);
  assert.ok(plans[2].purpose.length > 0);
});
test('premise commitments parse with safe fallbacks and enforce outline payoffs',()=>{
  const commitments = n.parsePremiseCommitments('{"essentialPlotPromises":["Restart the stopped clocks to restore missing guests"],"centralMystery":"Why did every clock stop at 3:00?","requiredEndingPayoffs":["Show the clocks restarting and the final consequence for vanished guests"]}', 'A haunted hotel with stopped clocks.');
  assert.ok(commitments.essentialPlotPromises.length >= 1);
  assert.match(commitments.centralMystery, /clock|mystery|why/i);

  const failingPlans = [
    {number:1,purpose:'Arrive at hotel',start:'Road',requiredEvents:['Elara enters the lobby and meets Miles.'],ending:'She commits to investigation.',introductions:['Elara','Miles'],optionalDetails:[]},
    {number:2,purpose:'Investigate rumors',start:'Hotel',requiredEvents:['Elara interviews townspeople and finds old records.'],ending:'She vows to keep searching.',introductions:[],optionalDetails:[]},
  ];
  assert.throws(()=>n.validatePremiseCoverage(failingPlans, commitments), /Missing ending payoffs|Missing core premise coverage/i);

  const passingPlans = [
    {number:1,purpose:'Arrive at hotel',start:'Road',requiredEvents:['Elara enters the lobby and discovers every clock is frozen at 3:00.'],ending:'She commits to restarting the clocks.',introductions:['Elara','Miles'],optionalDetails:[]},
    {number:2,purpose:'Resolve the clock mechanism',start:'Hotel',requiredEvents:['Elara restarts the stopped clocks and the vanished guests reappear with a cost.'],ending:'The final consequence for the restored guests is confronted on-page.',introductions:[],optionalDetails:[]},
  ];
  assert.doesNotThrow(()=>n.validatePremiseCoverage(passingPlans, commitments));
});
test('title generation retries near duplicates and fails boundedly',async()=>{
  const existing=['Radiance in the Shadows'];let calls=0;
  const title=await n.uniqueTitle(async()=>++calls===1?'Vibrance in the Shadows':'The Broken Palette',existing);
  assert.equal(title,'The Broken Palette');assert.equal(calls,2);
  await assert.rejects(n.uniqueTitle(async()=>'Radiance of Shadows',existing,2),/too similar/);
  assert.match(prompts.prompt11WriteChapterName('bible',plan,1,chapter,existing),/Radiance in the Shadows/);
});
test('all chapter contexts include accepted history and future restrictions',()=>{
  const state={version:1,chapters:[]};const context=n.contextFor([plan,{...plan,number:2,introductions:['Mira']}],1,state,'previous ending');
  for(const p of [prompts.prompt8WriteChapterX('bible',plan,1,'previous ending',JSON.stringify(state),5,10,context),prompts.prompt9ReviewChapterX('bible',plan,1,chapter,context),prompts.prompt10ImproveChapterX('bible',plan,1,chapter,[],context)]) {
    assert.match(p,/Mira/);assert.match(p,/previous ending/);assert.match(p,/Battle shadow creature/);assert.doesNotMatch(p,/300 words per page/);
  }
});
test('final revised outline is checked for repeated chapter objectives and missing setups before writing',()=>{
  const repeated=[
    {number:1,purpose:'The team hunts the relic in the swamp',start:'The marsh',requiredEvents:['The team enters the swamp and finds footprints.'],ending:'The team follows the trail into the fog.',introductions:['Nala'],optionalDetails:[]},
    {number:2,purpose:'The team hunts the relic in the swamp',start:'The marsh',requiredEvents:['The team keeps hunting the relic in the swamp.'],ending:'They break camp before sunrise.',introductions:[],optionalDetails:[]},
  ];
  assert.throws(()=>n.validateOutlineStructure(repeated), /repeated chapter objectives/i);

  const missingSetup=[
    {number:1,purpose:'The team reaches the gate',start:'The city gate',requiredEvents:['They reach the gate and argue about entry.'],ending:'The gate stays shut.',introductions:['Toma'],optionalDetails:[]},
    {number:2,purpose:'Toma reveals the truth to the team',start:'Inside the city',requiredEvents:['Toma reveals the secret pact to the team.'],ending:'The team realizes the plan is compromised.',introductions:[],optionalDetails:[]},
  ];
  assert.throws(()=>n.validateOutlineStructure(missingSetup), /missing setup/i);
});
test('setup detection allows differently worded foreshadowing context',()=>{
  const nuancedSetup=[
    {number:1,purpose:'Elara joins the Order scouts',start:'Order outpost',requiredEvents:['Elara receives fragmented clues about her origin and Trystan notices a crest tied to old records.'],ending:'They agree to investigate her past.',introductions:['Elara','Trystan'],optionalDetails:[]},
    {number:2,purpose:'The scouts map the headquarters perimeter',start:'Forest ridge',requiredEvents:['Kaelan warns that old mission records were erased and hints that recovered memories could expose hidden motives.'],ending:'They uncover a route to the archives.',introductions:['Kaelan'],optionalDetails:[]},
    {number:3,purpose:'The team commits to confronting the Order',start:'Archive chamber',requiredEvents:["Trystan deciphers the map, revealing the truth of Elara's heritage and why the Order needs her power."],ending:'The team sets a direct plan against headquarters.',introductions:[],optionalDetails:[]},
  ];
  assert.doesNotThrow(()=>n.validateOutlineStructure(nuancedSetup));
});
test('chapter selection and duplicate detection reject repeated content before saving',()=>{
  const state={version:1,chapters:[{number:1,ending:'The gate opened',completedEvents:[{description:'Open the gate',evidence:'ratchet open'}],developments:[{category:'events',subject:'chapter',fact:'Open the gate',evidence:'opened the gate'}]}]};
  const context=n.contextFor([
    plan,
    {...plan, number:2, requiredEvents:['Cross the river','Share memories'], ending:'River pact formed'}
  ],2,state,'Mira opened the gate and saw the mural.');
  assert.equal(context.currentPlan.number,2);
  assert.deepEqual(context.currentPlan.requiredEvents,['Cross the river','Share memories']);
  const duplicate = n.detectDuplicateChapter('Mira opened the gate and saw the mural. The gate creaked open and the siblings left the court transformed.', [{number:1,text:'Mira opened the gate and saw the mural. The gate creaked open and the siblings left the court transformed.'}]);
  assert.ok(duplicate);
  assert.equal(duplicate.chapterNumber,1);
  assert.match(duplicate.reason,/duplicate|identical|copied/i);
  assert.throws(()=>n.validateStoryState({version:1,chapters:[{number:1},{number:2,ending:'Reach the tower at dawn.',currentSituation:'Reach the tower at dawn.',completedEvents:[{description:'Reach the tower',evidence:'invented evidence'}],developments:[{category:'events',subject:'tower',fact:'Reached the tower',evidence:'invented evidence'}]}]},2,'Reach the tower at dawn.'),/Unsupported story-state evidence/);
});
test('verbatim previous-chapter replay cannot be approved by model judgment',async()=>{
  await assert.rejects(n.ensureValid({draft:chapter,previousChapter:chapter,plan,attempts:1,validate:async()=>good(),repair:async()=>chapter}),/repeats the previous chapter verbatim/);
});

test('full immediate previous prose and all older developments remain available',()=>{
 const prior='Opening. '+ 'A journey through the forest. '.repeat(400)+'The boat sank at midnight.';
 const history={version:1,chapters:[{number:1,ending:'The boat sank at midnight.',completedEvents:[],developments:Array.from({length:8},(_,i)=>({fact:`fact ${i}`}))}]};
 const context=n.contextFor([plan,{...plan,number:2}],2,history,prior);
 assert.equal(context.previousChapter,prior);
 assert.equal(context.storyHistory[0].developments.length,8);
 assert.throws(()=>n.contextFor([{...plan,number:2}],1,{chapters:[]},''),/selected plan/);
 assert.throws(()=>n.contextFor([plan,{...plan,number:2}],2,{chapters:[]},prior),/sequential/);
 const frozen=n.parsePlans({chapters:[plan]},1);assert.ok(Object.isFrozen(frozen[0].requiredEvents));
});
test('context tracks cumulative milestones and unresolved mysteries',()=>{
 const commitments=n.parsePremiseCommitments({
  essentialPlotPromises:['Resolve why the clocks stopped'],
  centralMystery:'Why did the clocks stop at 3:00?',
  requiredEndingPayoffs:['Explain the mechanism and consequence'],
 }, 'Clock mystery premise');
 const history={version:1,chapters:[
  {number:1,ending:'The clock room opens.',currentSituation:'They enter the room.',completedEvents:[],developments:[],resolvedMilestones:[{item:'Clock room discovered',status:'advanced',evidence:'clock room opens'}],activeMysteries:[{question:'Who stopped the clocks?',state:'open',evidence:'nobody knows'}]},
  {number:2,ending:'A suspect is named.',currentSituation:'Suspicion rises.',completedEvents:[],developments:[],resolvedMilestones:[{item:'First mechanism clue found',status:'advanced',evidence:'mechanism clue'}],activeMysteries:[{question:'Who stopped the clocks?',state:'partially answered',evidence:'a suspect is named'}]},
 ]};
 const context=n.contextFor([plan,{...plan,number:2},{...plan,number:3}],3,history,'Prior chapter prose',commitments);
 assert.ok(context.completedMilestones.includes('Clock room discovered'));
 assert.ok(context.activeMysteries.some(item=>/who stopped the clocks/i.test(item.question)));
 assert.equal(context.premiseCommitments.centralMystery,commitments.centralMystery);
});
test('state comes from prose extraction, preserves older facts and rejects invalid evidence',()=>{
 const extracted={number:1,ending:'She returned home.',currentSituation:'She returned home.',completedEvents:[{description:'Lyra discovered protection',evidence:'A shield rose.'}],developments:[{category:'abilities',subject:'Lyra',fact:'A shield appeared',evidence:'A shield rose.'}]};
 const state=n.buildStoryStateEntry({number:1,chapterText:chapter,plan,extracted});
 assert.equal(state.chapters[0].completedEvents[0].description,'Lyra discovered protection');
 const next={...extracted,number:2};
 const later=n.buildStoryStateEntry({number:2,chapterText:chapter,extracted:next,previousState:state});
 assert.equal(later.chapters[0],state.chapters[0]);assert.equal(state.chapters.length,1);
 for(const bad of ['not json',{...extracted,number:3},{...extracted,ending:'She flew away.'},{...extracted,developments:[{category:'knowledge',subject:'Lyra',fact:'Knows a secret',evidence:'invented quotation'}]}]) {
  assert.throws(()=>n.buildStoryStateEntry({number:1,chapterText:chapter,extracted:bad}));
 }
});
test('story-state summaries are accepted when backed by cited evidence',()=>{
 const chapterText='Lyra crossed the bridge at dusk. The storm finally passed and the village gates opened.';
 const extracted={
  number:1,
  ending:'The chapter ends with a safe return to the village.',
  endingEvidence:'the village gates opened',
  currentSituation:'The immediate threat has passed for now.',
  currentSituationEvidence:'The storm finally passed',
  completedEvents:[],
  developments:[{category:'consequences',subject:'village',fact:'The danger has eased',evidence:'The storm finally passed'}],
 };
 assert.doesNotThrow(()=>n.buildStoryStateEntry({number:1,chapterText,extracted}));
});
test('story-state extraction tolerates fenced JSON and trailing commas while requiring supported evidence',()=>{
 const chapterText='Lyra fought the creature.\n\nA shield rose as she returned home.';
 const extracted='```json\n{"number":1,"ending":"A shield rose as she returned home.","currentSituation":"A shield rose as she returned home.","completedEvents":[{"description":"Lyra fought the creature","evidence":"Lyra fought the creature."},],"developments":[{"category":"abilities","subject":"Lyra","fact":"A shield rose","evidence":"A shield rose"},],}\n```';
 const state=n.buildStoryStateEntry({number:1,chapterText,extracted});
 assert.equal(state.chapters[0].completedEvents.length,1);
 assert.equal(state.chapters[0].developments.length,1);
});
test('story-state ending accepts closing-prose excerpts from final paragraphs without requiring both fields in the last sentence',()=>{
 const chapterText='Lyra fought through the storm.\n\nAt the threshold, the shield dimmed and she limped forward.\n\nShe returned home before dawn.';
 const extracted={
  number:1,
  ending:'At the threshold, the shield dimmed and she limped forward.',
  currentSituation:'She returned home before dawn.',
  completedEvents:[{description:'Lyra survived the storm',evidence:'Lyra fought through the storm.'}],
  developments:[{category:'events',subject:'Lyra',fact:'She returned home',evidence:'She returned home before dawn.'}],
 };
 assert.doesNotThrow(()=>n.buildStoryStateEntry({number:1,chapterText,extracted}));
});
const sequence = (prefix,count) => Array.from({length:count},(_,i)=>`${prefix}${i}`).join(' ');
test('duplicate comparisons detect passages and small edits, but allow shared vocabulary',()=>{
 const original=sequence('word',400);
 const near=original.split(' ').map((w,i)=>i%90===0?'changed'+i:w).join(' ');
 assert.match(n.detectDuplicateChapter(near,[{number:6,text:original}]).reason,/Near-identical/);
 assert.equal(n.detectDuplicateChapter('**'+original.toUpperCase()+'**',[{number:6,text:original}]).similarity,1);
 const copied=sequence('new',250)+' '+original.split(' ').slice(100,220).join(' ')+' '+sequence('other',250);
 assert.match(n.detectDuplicateChapter(copied,[{number:6,text:original}]).reason,/copied passages/);
 // Identical vocabulary in a different sequence is not a repeated chapter.
 const distinct=original.split(' ').reverse().join(' ');
 assert.equal(n.detectDuplicateChapter(distinct,[{number:6,text:original}]),null);
 assert.equal(n.detectDuplicateChapter('Mira walked along the river with Jules and discussed courage.',[{number:1,text:'Jules asked Mira about courage before returning to the river.'}]),null);
 assert.equal(n.detectDuplicateChapter('```\n'+original+'\n```',[{number:1,text:original}]).similarity,1);
});
