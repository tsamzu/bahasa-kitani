(()=>{'use strict';
const field=document.getElementById('bk-global-query');
const result=document.getElementById('bk-global-results');
if(!field||!result)return;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cap=value=>String(value??'').replace(/(^|[\s/-])([a-zà-ÿ])/g,(_,sep,ch)=>sep+ch.toUpperCase());
let entries=typeof WORDS!=='undefined'&&Array.isArray(WORDS)?WORDS.map(w=>({word:cap(w.tutong),ms:w.malay,en:w.english,lang:'Bahasa Tutong',id:'tutong',status:'Existing collection'})):[];
let loaded=false;
BKCollections.load().then(({brunei,dusun})=>{
 entries=entries.concat(brunei.map(w=>({word:w.headword,ms:w.standardMalay,en:w.english,lang:'Bahasa Melayu Brunei',id:'brunei',status:w.status==='reviewed'?'Community checked':'Needs review'})));
 entries=entries.concat(dusun.map(w=>({word:w.headword,ms:w.standardMalay,en:w.english,lang:'Bahasa Dusun Brunei',id:'dusun',status:'Source-attested / needs review'})));
 loaded=true;show();
});
field.addEventListener('input',show);
function show(){
 const q=field.value.toLocaleLowerCase().trim();
 if(!q){result.innerHTML='';return}
 const items=entries.filter(w=>[w.word,w.ms,w.en].some(v=>String(v||'').toLocaleLowerCase().includes(q))).slice(0,9);
 result.innerHTML=items.length?items.map(w=>'<a href="?lang='+encodeURIComponent(w.id)+'&q='+encodeURIComponent(w.word)+'#dictionary"><strong>'+esc(w.word)+'</strong><span>'+esc(w.ms)+' · '+esc(w.en)+'</span><small>'+esc(w.lang)+' · '+esc(w.status)+'</small></a>').join(''):'<p>'+(loaded?'No matching word in the current draft.':'Loading additional language collections…')+'</p>';
}
})();