import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import processor from '../scripts/process-contribution.cjs';
const context = vm.createContext({ URL });
for (const path of ['core.js','contributor-core.js']) vm.runInContext(readFileSync(new URL('../'+path,import.meta.url),'utf8'),context);
const { BK, BKC } = context;
const plain = value => JSON.parse(JSON.stringify(value));
const word = {id:7,tutong:'Empa / Eppa',malay:'Air',english:'Water',cat:'Nature',notation:'variant',note:''};
const other = {id:10,tutong:'Uceng',malay:'Kucing',english:'Cat',cat:'Animals',notation:'',note:''};
const corpus = {words:[word,other],phrases:[{id:2,tutong:'Test phrase',malay:'Frasa',english:'Phrase',cat:'Daily Life'}],categories:['All','Animals','Nature']};
const proposal = () => ({app:'bahasa-kitani-contribution',version:1,kind:'word',action:'add',entry:{tutong:'Example',malay:'Contoh',english:'Example',cat:'Nature',notation:'',note:''}});
const source = 'const CATEGORIES=["All","Nature","Animals"];\nconst WORDS = [\n'+BKC.formatEntry(word)+'\n'+BKC.formatEntry(other)+'\n];\nconst PHRASES = [\n'+BKC.formatEntry(corpus.phrases[0],'phrase')+'\n];\nconst NUMBERS=[];';
test('entry export matches dictionary syntax and preserves quotes, apostrophes and newlines',()=>{
  const entry={...word,id:766,tutong:'Amun / Amunan',note:'He said "yes".\nBird’s beak; '+String.fromCharCode(96).repeat(3)};
  const formatted=BKC.formatEntry(entry);
  assert(formatted.startsWith('  { id:766, tutong:"Amun / Amunan"'));
  assert(!formatted.includes('"tutong":'));
  assert.deepEqual(plain(vm.runInNewContext('['+formatted+']')[0]),entry);
});
test('search ranks exact aliases above partial matches and respects language filters',()=>{
  const list=[{...other,id:11,tutong:'Buwa',malay:'Tembikai',english:'Watermelon'},word,other];
  assert.equal(BK.findWords(list,{query:'water'}).results[0].id,7);
  assert.equal(BK.findWords(list,{query:'eppa'}).results[0].id,7);
  assert.equal(BK.findWords(list,{query:'kucing',language:'malay'}).results[0].id,10);
  assert.equal(BK.findWords(list,{query:'kucing',language:'english'}).results.length,0);
});
test('typo suggestions detect transposition without crossing category or saved filters',()=>{
  assert.equal(BK.editDistance('wtaer','water'),1);
  const found=BK.findWords([word,other],{query:'wtaer'});
  assert.equal(found.approximate,true);assert.equal(found.results[0].id,7);
  assert.equal(BK.findWords([word,other],{query:'wtaer',category:'Animals'}).results.length,0);
  assert.equal(BK.findWords([word,other],{query:'wtaer',savedOnly:true,saved:new Set([10])}).results.length,0);
  assert.equal(BK.findWords([word],{query:'x',fuzzy:true}).approximate,false);
});
test('multiword search works with different word order and keeps source order intact',()=>{
  const list=[{...word,english:"Bird's Beak"},other], before=JSON.stringify(list);
  assert.equal(BK.findWords(list,{query:'beak bird'}).results[0].id,7);
  assert.equal(JSON.stringify(list),before);
});
const progress={saved:[7],learned:[7],days:['2026-10-28'],lessonIndex:2,theme:'night'};
test('progress backup round trip validates its version, dates, IDs and file size',()=>{
  const file=BK.createProgressBackup(progress,new Date('2026-10-28T08:00:00Z'));
  assert.deepEqual(plain(BK.parseProgressBackup(JSON.stringify(file)).data),progress);
  for(const invalid of ['{}','{bad',JSON.stringify({...file,version:99}),JSON.stringify({...file,data:{...progress,saved:['7']}}),JSON.stringify({...file,data:{...progress,days:['2026-02-30']}}),'x'.repeat(1000001)]) assert.throws(()=>BK.parseProgressBackup(invalid));
});
test('merge keeps existing progress, replace is explicit, and unavailable IDs are skipped',()=>{
  const incoming={saved:[10,999],learned:[10],days:['2026-10-27'],lessonIndex:0,theme:'day'};
  const before=JSON.stringify(progress);
  const merged=BK.restoreProgress(progress,incoming,{validIds:new Set([7,10])});
  assert.deepEqual(plain(merged.data.saved),[7,10]);assert.equal(merged.missing,1);assert.equal(merged.data.theme,'night');
  const replaced=BK.restoreProgress(progress,incoming,{mode:'replace',validIds:new Set([7,10])});
  assert.deepEqual(plain(replaced.data.saved),[10]);assert.equal(replaced.data.theme,'day');
  assert.equal(JSON.stringify(progress),before);assert.throws(()=>BK.restoreProgress(progress,incoming,{mode:'bad'}));
});
test('contributions reject duplicates, unknown categories and stale corrections',()=>{
  assert.throws(()=>BKC.validateProposal({...proposal(),entry:word},corpus),/already exist/);
  assert.throws(()=>BKC.validateProposal({...proposal(),entry:{...proposal().entry,cat:'Wrong'}},corpus),/category/);
  const correction={...proposal(),action:'update',entry:{...word,english:'Fresh water'},original:word};
  assert.equal(BKC.validateProposal(correction,corpus).entry.id,7);
  assert.throws(()=>BKC.validateProposal({...correction,original:{...word,english:'Changed'}},corpus),/changed since/);
});
test('review URLs preserve structured proposals and never require a browser token',()=>{
  const clean=BKC.validateProposal(proposal(),corpus),url=new URL(BKC.issueUrl(clean));
  assert.equal(url.origin,'https://github.com');assert(!url.searchParams.has('access_token'));
  assert.deepEqual(plain(BKC.proposalFromBody(url.searchParams.get('body'))),plain(clean));
  assert.throws(()=>BKC.proposalFromBody('plain text'));
});
test('publisher allocates IDs above pending reservations and never executes entry strings',()=>{
  const malicious={...proposal(),entry:{...proposal().entry,tutong:'Test "quoted"',english:'"); globalThis.HACKED=1; //',note:'$'+'(echo nope)'}};
  const result=BKC.applyToSource(source,malicious,corpus,[20,40]);
  assert.equal(result.entry.id,41);
  const loaded=processor.loadCorpus(result.source);assert.equal(loaded.words.length,3);assert.equal(loaded.words[2].english,malicious.entry.english);
  assert.equal(loaded.words[0].tutong,word.tutong);
  const check=vm.createContext({});vm.runInContext(result.source,check);assert.equal(check.HACKED,undefined);
});
test('publisher updates only the selected entry and refuses duplicate corpus IDs',()=>{
  const correction={...proposal(),action:'update',entry:{...word,english:'Fresh water'},original:word};
  const result=BKC.applyToSource(source,correction,corpus);
  assert(result.source.includes('\n  { id:7,'));assert(result.source.includes('\n  { id:10,'));
  const loaded=processor.loadCorpus(result.source);assert.equal(loaded.words[0].id,7);assert.equal(loaded.words[0].english,'Fresh water');assert.equal(loaded.words[1].english,'Cat');
  assert.throws(()=>processor.loadCorpus(source.replace('id:10','id:7')),/duplicate/);
});
test('review processing requires a maintainer approval event before any writes',async()=>{
  const event={action:'labeled',label:{name:'dictionary-approved'},issue:{number:4,body:new URL(BKC.issueUrl(proposal())).searchParams.get('body')},sender:{login:'visitor'}};
  const calls=[];
  await assert.rejects(processor.stage(event,'owner/repo',async(method,path)=>{calls.push([method,path]);return {permission:'read'};}),/maintainer/);
  assert(calls.every(([method])=>method==='GET'));
  await assert.rejects(processor.stage({...event,action:'edited'},'owner/repo',async()=>{throw new Error('Unexpected API call');}),/approve/);
});
test('review processing stages only dictionary files and never changes main',async()=>{
  const body=new URL(BKC.issueUrl(proposal())).searchParams.get('body'), writes=[];
  const event={action:'labeled',label:{name:'dictionary-approved'},issue:{number:42,body},sender:{login:'owner'}};
  const api=async(method,path,data)=>{
    if(method!=='GET'){writes.push({method,path,data});if(path.endsWith('/git/trees'))return {sha:'tree'};if(path.endsWith('/git/commits'))return {sha:'commit'};return {};}
    if(path.endsWith('/permission'))return {permission:'admin'};
    if(path.endsWith('/git/ref/heads/main'))return {object:{sha:'abcdef012345'}};
    if(path.includes('/contents/data/tutong.js'))return {encoding:'base64',content:Buffer.from(source).toString('base64')};
    if(path.includes('/git/ref/heads/contributions/'))return null;
    if(path.includes('/git/matching-refs/'))return [];
    if(path.includes('/git/commits/'))return {tree:{sha:'base-tree'}};
    throw new Error('Unexpected API path: '+path);
  };
  const result=await processor.stage(event,'owner/repo',api);
  assert(result.url.includes('/compare/main...contributions/issue-42-'));
  const tree=writes.find(item=>item.path.endsWith('/git/trees'));
  assert.deepEqual(tree.data.tree.map(item=>item.path),['data/tutong.js','.github/contributions/issue-42.json']);
  assert(writes.some(item=>item.data.ref?.startsWith('refs/heads/contributions/issue-42-')));
  assert(!writes.some(item=>item.path.endsWith('/git/refs/heads/main')));
});
test('retiring a proposal only removes its own contribution branches',async()=>{
  const removed=[];
  const event={action:'closed',issue:{number:4},sender:{login:'owner'}};
  const result=await processor.cleanup(event,'owner/repo',async(method,path)=>{
    if(method==='DELETE'){removed.push(path);return {};}
    if(path.endsWith('/permission'))return {permission:'write'};
    return [{ref:'refs/heads/main'},{ref:'refs/heads/contributions/issue-42-other'},{ref:'refs/heads/contributions/issue-4-approved'}];
  });
  assert.equal(result.removed,1);assert.equal(removed.length,1);assert(removed[0].endsWith('heads/contributions/issue-4-approved'));
});
test('a public issue author cannot retire approved review branches',async()=>{
  const methods=[];
  const result=await processor.cleanup({action:'closed',issue:{number:4},sender:{login:'visitor'}},'owner/repo',async(method)=>{methods.push(method);return {permission:'read'};});
  assert.equal(result.removed,0);assert.deepEqual(methods,['GET']);
});
test('entry notes remain searchable without outranking actual word matches',()=>{
  const list=[{...other,note:'water'},{...word,english:'Water source'}];
  assert.equal(BK.findWords(list,{query:'water'}).results[0].id,7);
  assert.equal(BK.findWords(list,{query:'water'}).results.length,2);
});
test('phrase proposals use their own IDs and preserve the word dictionary',()=>{
  const input={...proposal(),kind:'phrase',entry:{tutong:'New phrase',malay:'Frasa baru',english:'New phrase',cat:'Daily Life'}};
  const applied=BKC.applyToSource(source,input,corpus,[8]);
  const loaded=processor.loadCorpus(applied.source);
  assert.equal(applied.entry.id,9);assert.equal(loaded.phrases.length,2);
  assert.deepEqual(plain(loaded.words),corpus.words);
});
