const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('cache matches exact prompt and retains earlier exact requests for the same author',async()=>{
  let stored=JSON.stringify({entries:{old:{bucketKey:'generateResponse:mock:aria',value:'unrelated cached chapter'}}}), calls=0;
  const fakeFs={...fs,existsSync:p=>String(p).endsWith('author_speak_cache.json')||fs.existsSync(p),readFileSync:(p,...args)=>String(p).endsWith('author_speak_cache.json')?stored:fs.readFileSync(p,...args),mkdirSync:()=>{},writeFileSync:(p,data)=>{assert.match(p,/author_speak_cache.json$/);stored=data;}};
  const sandbox={module:{exports:{}},__dirname:__dirname,Buffer,process:{env:{OPENAI_API_KEY:'test',OPENAI_MODEL:'mock',USE_CACHE:'true',CACHE_RESULTS:'true'}},require:name=>name==='fs'?fakeFs:require(name),fetch:async()=>({ok:true,json:async()=>({output_text:`response ${++calls}`})})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'author_speak.js'),'utf8'),sandbox);
  const author=require('../authors/authors.json')[0].id;
  const generate=sandbox.module.exports.generateResponse;
  const prompts=require('./prompts');
  const plan=number=>({number,purpose:'travel',start:'river',requiredEvents:[`Event ${number}`],ending:'camp',introductions:[],optionalDetails:[]});
  const firstPrompt=prompts.prompt8WriteChapterX('bible',plan(6),6,'previous five','history');
  const secondPrompt=prompts.prompt8WriteChapterX('bible',plan(7),7,'previous six','updated history');
  const metadata=[];
  const first=await generate(author,firstPrompt,{onCacheMetadata:m=>metadata.push(m)});
  const second=await generate(author,secondPrompt,{onCacheMetadata:m=>metadata.push(m)});
  assert.notEqual(first,second);assert.equal(await generate(author,firstPrompt,{onCacheMetadata:m=>metadata.push(m)}),first);assert.equal(calls,2);
  assert.deepEqual(metadata.map(m=>m.hit),[false,false,true]);
  const changedContext=await generate(author,secondPrompt+'\nA new actual development');assert.notEqual(changedContext,second);
  sandbox.process.env.OPENAI_MODEL='another-model';
  assert.notEqual(await generate(author,secondPrompt),second);
  assert.notEqual(await generate(require('../authors/authors.json')[1].id,secondPrompt),second);
  assert.equal(calls,5);
});

test('generateResponse tracks the current call metadata without stale cache hits', async () => {
  let stored = JSON.stringify({ entries: {} });
  let calls = 0;
  const fakeFs = {
    ...fs,
    existsSync: (p) => String(p).endsWith('author_speak_cache.json') || fs.existsSync(p),
    readFileSync: (p, ...args) => String(p).endsWith('author_speak_cache.json') ? stored : fs.readFileSync(p, ...args),
    mkdirSync: () => {},
    writeFileSync: (p, data) => { stored = data; },
  };
  const sandbox = {
    module: { exports: {} },
    __dirname,
    Buffer,
    process: { env: { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'mock', USE_CACHE: 'true', CACHE_RESULTS: 'true' } },
    require: (name) => name === 'fs' ? fakeFs : require(name),
    fetch: async () => ({ ok: true, json: async () => ({ output_text: `response ${++calls}` }) }),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'author_speak.js'), 'utf8'), sandbox);
  const author = require('../authors/authors.json')[0].id;
  const generate = sandbox.module.exports.generateResponse;

  const firstPrompt = 'A new first prompt for metadata tracking';
  const secondPrompt = 'A second prompt for a fresh metadata check';
  await generate(author, firstPrompt);
  assert.equal(generate.lastCacheMetadata.hit, false);
  const firstMeta = { ...generate.lastCacheMetadata };

  await generate(author, secondPrompt);
  assert.equal(generate.lastCacheMetadata.hit, false);
  assert.notDeepEqual(generate.lastCacheMetadata.cacheKey, firstMeta.cacheKey);

  await generate(author, firstPrompt);
  assert.equal(generate.lastCacheMetadata.hit, true);
  assert.equal(generate.lastCacheMetadata.cacheKey, firstMeta.cacheKey);
});
