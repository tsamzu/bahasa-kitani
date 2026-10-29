import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../' + file, import.meta.url),'utf8');
const context = vm.createContext({});
for (const file of ['core.js','collections.js']) vm.runInContext(read(file),context);
const {BK,BKCollections:C} = context, plain = value => JSON.parse(JSON.stringify(value));
const source = {words:[{id:1,tutong:'Test',malay:'Ujian',english:'Test',cat:'Fruits',note:''}],phrases:[],numbers:[],brunei:JSON.parse(read('data/brunei.json')),dusun:JSON.parse(read('data/dusun.json'))};
const catalog = C.build(source);
test('shared topics keep original source categories and reviewed examples intact', () => {
  const tah = catalog.words.find(word => word.sourceId === 'brunei-017');
  assert.equal(tah.cat,'Everyday Words'); assert.equal(tah.sourceCategory,'Perkataan asas');
  assert.deepEqual(plain(tah.examples.map(example => [example.text,example.explanation])),source.brunei.find(word => word.id === 'brunei-017').usageExamples.map(example => [example.text,example.userExplanation]));
  assert(tah.examples.every(example => example.status === 'reviewed'));
  assert.equal(catalog.words.find(word => word.id === 1).cat,'Food & Drink');
  assert.equal(source.words[0].cat,'Fruits');
  assert.equal(C.categoryName('Family & People'),'People');
});
test('indexed search includes separately recorded variants and keeps review and collection filters together', () => {
  const words = [{id:1,tutong:'Empa',variants:['Eppa'],malay:'Air',english:'Water',cat:'Nature',language:'tutong',status:'existing'},{id:2,tutong:'Air',malay:'Air',english:'Water',cat:'Everyday Words',language:'brunei',status:'reviewed'},{id:3,tutong:'Draft',malay:'Air',english:'Water',cat:'Nature',language:'dusun',status:'source'}];
  const index = BK.createSearchIndex(words); assert.equal(index,BK.createSearchIndex(words));
  assert.equal(BK.findWords(words,{query:'eppa'}).results[0].id,1);
  assert.deepEqual(plain(BK.findWords(words,{query:'water',collection:'brunei',review:'reviewed'}).results.map(word => word.id)),[2]);
  assert.deepEqual(plain(BK.findWords(words,{query:'water',review:'pending',category:'Nature'}).results.map(word => word.id)),[3]);
});
const foreign = C.progressId('dusun','dusun-web-074');
const progress = {saved:[1,foreign],learned:[1],days:['2026-10-29'],lessonIndex:0,theme:'day',mistakes:[foreign],lists:[{id:'list-a',name:'At home',words:[1,foreign]}]};
test('old backups still restore and new backups retain lists, foreign IDs and review words', () => {
  const file = BK.createProgressBackup(progress), parsed = BK.parseProgressBackup(JSON.stringify(file));
  assert.equal(file.version,1); assert.deepEqual(plain(parsed.data),progress);
  const old = {...progress}; delete old.lists; delete old.mistakes;
  const restored = BK.restoreProgress(progress,old,{mode:'replace',validIds:new Set([1,foreign])});
  assert.deepEqual(plain(restored.data.lists),[]); assert.deepEqual(plain(restored.data.mistakes),[]);
});
test('list merge combines membership without dropping existing names or saved words', () => {
  const next = {...progress,saved:[foreign,3],mistakes:[3],lists:[{id:'list-a',name:'An old list name',words:[foreign,3]},{id:'list-b',name:'People',words:[3]}]};
  const result = BK.restoreProgress(progress,next,{validIds:new Set([1,foreign,3])});
  assert.deepEqual(plain(result.data.lists),[{id:'list-a',name:'At home',words:[1,foreign,3]},{id:'list-b',name:'People',words:[3]}]);
  assert.deepEqual(plain(result.data.mistakes),[foreign,3]);
  assert.throws(() => BK.parseProgressBackup(JSON.stringify({...BK.createProgressBackup(progress),data:{...progress,lists:[{id:'<unsafe>',name:'X',words:[1]}]}})),/study list/);
});
test('a fast collection becomes available before a slow collection settles', async () => {
  let release;
  const slow = new Promise(resolve => release = resolve), snapshots = [];
  const ctx = vm.createContext({AbortController,setTimeout,clearTimeout,fetch:async url => {
    if (url.includes('brunei')) await slow;
    return {ok:true,json:async () => url.includes('brunei') ? source.brunei : source.dusun};
  }});
  vm.runInContext(read('collections.js'),ctx);
  const loading = ctx.BKCollections.load(snapshot => snapshots.push(snapshot));
  await new Promise(resolve => setTimeout(resolve,0));
  assert(snapshots.some(snapshot => snapshot.dusun.length && !snapshot.brunei.length));
  release(); const result = await loading; assert.equal(result.loaded.length,2);
});

test('navigation binds before pending collections settle and existing foreign progress survives boot', async () => {
  class Element {
    constructor(id='') {this.id=id; this.dataset={}; this.hidden=false; this.value=''; this.style={}; this.handlers={}; this.classList={add(){},remove(){},toggle(){}};}
    addEventListener(type,fn) {(this.handlers[type] ||= []).push(fn);}
    setAttribute(key,value) {this[key]=value;}
    removeAttribute(key) {delete this[key];}
    focus() {}
    querySelectorAll() {return [];}
  }
  const ids = new Map([...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(match => [match[1],new Element(match[1])]));
  const views = ['home','dictionary','learn','lesson','phrases','numbers','words','practice','community'].map(route => {const el=ids.get('view-'+route);el.dataset.view=route;return el;});
  const nav = new Element(); nav.dataset.route='learn'; nav.closest=() => nav;
  const handlers={}, location=new URL('https://bahasa-kitani.xyz/');
  const values=new Map(Object.entries({'bk-saved':JSON.stringify(progress.saved),'bk-lists':JSON.stringify(progress.lists)}));
  let hooks, calls=0;
  const doc={documentElement:{dataset:{}},activeElement:{tagName:'BODY'},title:'',querySelector:selector => ids.get(selector.slice(1)) || new Element(),querySelectorAll:selector => selector === '.view' ? views : selector === '[data-route]' ? [nav] : [],addEventListener:(type,fn) => handlers[type]=fn};
  const ctx=vm.createContext({document:doc,location,URL,URLSearchParams,setTimeout,clearTimeout,AbortController,navigator:{},history:{pushState(_a,_b,url){location.href=url},replaceState(_a,_b,url){location.href=url}},window:{localStorage:{getItem:key => values.get(key) ?? null,setItem:(key,value) => values.set(key,value)},scrollTo(){},addEventListener(){}},BKUI:{init(options){hooks=options; return {refreshSearch(){}}}},fetch:() => {calls++; return new Promise(() => {});}});
  for (const file of ['core.js','collections.js','data/tutong.js','app.js']) vm.runInContext(read(file),ctx);
  assert.equal(calls,2); assert(hooks); assert.deepEqual(plain(hooks.getProgress().saved),progress.saved);
  handlers.click({target:{closest:selector => selector==='[data-route]' ? nav : null},button:0,preventDefault(){}});
  assert.equal(ids.get('view-learn').hidden,false); assert.equal(ids.get('view-home').hidden,true); assert.equal(location.hash,'#learn');
  assert.deepEqual(plain(hooks.getProgress().lists),progress.lists);
  nav.dataset.route='numbers'; nav.dataset.collection='dusun';
  handlers.click({target:{closest:selector => selector==='[data-route]' ? nav : null},button:0,preventDefault(){}});
  assert.equal(ids.get('numbers-empty').hidden,false);
  assert.equal(ids.get('numbers-empty').textContent,'Loading Dusun Brunei numbers…');
});

test('legacy dictionary and language URLs retain safe query and language selection', () => {
  for (const [input,expected] of [
    ['https://bahasa-kitani.xyz/languages.html?lang=dusun&q=Abuk','https://bahasa-kitani.xyz/index.html?lang=dusun&q=Abuk#dictionary'],
    ['https://bahasa-kitani.xyz/languages.html?q=water#brunei','https://bahasa-kitani.xyz/index.html?q=water&lang=brunei#dictionary'],
    ['https://bahasa-kitani.xyz/dictionary.html?q=water','https://bahasa-kitani.xyz/index.html?q=water#dictionary']
  ]) {
    let redirected;
    const location = new URL(input); location.replace = url => redirected=url;
    vm.runInNewContext(read('redirect.js'),{location,URL,URLSearchParams}); assert.equal(redirected,expected);
  }
});
