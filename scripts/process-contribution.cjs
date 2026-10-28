/* GitHub Actions entry point. Proposal text is JSON data, never shell or executable code. */
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const root = resolve(__dirname, '..');
function helpers() {
  const context = vm.createContext({ URL });
  for (const file of ['core.js','contributor-core.js']) vm.runInContext(readFileSync(resolve(root,file),'utf8'),context,{timeout:1000});
  return { BK: context.BK, BKC: context.BKC };
}
function loadCorpus(source) {
  const context = vm.createContext({});
  vm.runInContext(source + ';globalThis.corpus={words:WORDS,phrases:PHRASES,categories:CATEGORIES};',context,{timeout:1000});
  const corpus = context.corpus;
  for (const list of [corpus.words,corpus.phrases]) {
    if (!Array.isArray(list) || new Set(list.map(entry => entry.id)).size !== list.length) throw new Error('The dictionary contains duplicate IDs.');
    for (const entry of list) {
      if (!Number.isSafeInteger(entry.id) || entry.id < 1) throw new Error('The dictionary contains invalid IDs.');
      for (const field of ['tutong','malay','english','cat']) if (typeof entry[field] !== 'string') throw new Error('The dictionary has an invalid entry.');
    }
  }
  return corpus;
}
const isMaintainer = permission => ['admin','maintain','write'].includes(permission);
function compareUrl(repo, branch, number) {
  const url = new URL('https://github.com/' + repo + '/compare/main...' + branch);
  url.searchParams.set('quick_pull','1'); url.searchParams.set('title','Review dictionary proposal #' + number);
  url.searchParams.set('body','Review the proposed dictionary entry and wait for Site checks to pass before merging.\n\nCloses #' + number);
  return url.href;
}
async function stage(event, repo, api) {
  if (event.action !== 'labeled' || event.label?.name !== 'dictionary-approved' || event.issue?.pull_request) throw new Error('A maintainer must approve this issue with dictionary-approved.');
  const number = event.issue?.number;
  if (!Number.isSafeInteger(number) || number < 1 || !event.sender?.login) throw new Error('Invalid GitHub issue event.');
  const basePath = '/repos/' + repo;
  const permission = await api('GET',basePath + '/collaborators/' + encodeURIComponent(event.sender.login) + '/permission');
  if (!isMaintainer(permission.permission)) throw new Error('Only a repository maintainer can approve publication.');
  const { BKC } = helpers();
  const raw = BKC.proposalFromBody(event.issue.body);
  const ref = await api('GET',basePath + '/git/ref/heads/main'), base = ref.object.sha;
  const content = await api('GET',basePath + '/contents/data/tutong.js?ref=' + base);
  if (content.encoding !== 'base64' || typeof content.content !== 'string') throw new Error('Cannot read the dictionary source.');
  const source = Buffer.from(content.content.replace(/\s/g,''),'base64').toString('utf8'), corpus = loadCorpus(source);
  const proposal = BKC.validateProposal(raw,corpus);
  const hash = createHash('sha256').update(JSON.stringify(proposal)).digest('hex').slice(0,10);
  const branch = 'contributions/issue-' + number + '-' + base.slice(0,8) + '-' + hash;
  const existing = await api('GET',basePath + '/git/ref/heads/' + branch,null,true);
  if (existing) return { number, branch, url:compareUrl(repo,branch,number), alreadyPrepared:true };
  const refs = await api('GET',basePath + '/git/matching-refs/heads/contributions/issue-');
  const reserved = [];
  for (const item of refs || []) {
    const name = item.ref?.replace('refs/heads/',''), match = name?.match(/^contributions\/issue-(\d+)-/);
    if (!match) continue;
    const file = await api('GET',basePath + '/contents/.github/contributions/issue-' + match[1] + '.json?ref=' + encodeURIComponent(name),null,true);
    if (!file?.content) continue;
    try {
      const reservation = JSON.parse(Buffer.from(file.content.replace(/\s/g,''),'base64').toString('utf8'));
      if (reservation.kind === proposal.kind && Number.isSafeInteger(reservation.id) && reservation.id > 0) reserved.push(reservation.id);
    } catch { throw new Error('An existing contribution reservation needs maintainer review.'); }
  }
  const applied = BKC.applyToSource(source,proposal,corpus,reserved);
  if (!applied.changed) return { number, unchanged:true };
  if (!Number.isSafeInteger(applied.entry.id)) throw new Error('Unable to allocate a safe entry ID.');
  loadCorpus(applied.source);
  const commit = await api('GET',basePath + '/git/commits/' + base);
  const tree = await api('POST',basePath + '/git/trees',{
    base_tree:commit.tree.sha,
    tree:[
      {path:'data/tutong.js',mode:'100644',type:'blob',content:applied.source},
      {path:'.github/contributions/issue-' + number + '.json',mode:'100644',type:'blob',content:JSON.stringify({issue:number,kind:proposal.kind,id:applied.entry.id,action:proposal.action},null,2)+'\n'}
    ]
  });
  const created = await api('POST',basePath + '/git/commits',{message:'Prepare dictionary proposal #' + number,tree:tree.sha,parents:[base]});
  await api('POST',basePath + '/git/refs',{ref:'refs/heads/' + branch,sha:created.sha});
  return { number, branch, url:compareUrl(repo,branch,number), id:applied.entry.id };
}
async function cleanup(event, repo, api) {
  const number = event.issue?.number;
  if (event.action !== 'closed' || !Number.isSafeInteger(number) || !event.sender?.login) throw new Error('Invalid contribution close event.');
  const base = '/repos/' + repo;
  const permission = await api('GET',base + '/collaborators/' + encodeURIComponent(event.sender.login) + '/permission');
  if (!isMaintainer(permission.permission)) return { removed:0 };
  const refs = await api('GET',base + '/git/matching-refs/heads/contributions/issue-' + number + '-');
  let removed = 0;
  for (const item of refs || []) {
    const prefix = 'refs/heads/contributions/issue-' + number + '-';
    if (!item.ref?.startsWith(prefix)) continue;
    const name = item.ref.slice('refs/heads/'.length).split('/').map(encodeURIComponent).join('/');
    await api('DELETE',base + '/git/refs/heads/' + name); removed++;
  }
  return { removed };
}
async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')), repo = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !process.env.GH_TOKEN) throw new Error('Missing GitHub Actions context.');
  const api = async (method,path,body = null,allowMissing = false) => {
    const response = await fetch('https://api.github.com' + path,{method,headers:{Authorization:'Bearer ' + process.env.GH_TOKEN,Accept:'application/vnd.github+json','User-Agent':'bahasa-kitani-contributions','X-GitHub-Api-Version':'2022-11-28',...(body ? {'Content-Type':'application/json'} : {})},...(body ? {body:JSON.stringify(body)} : {})});
    if (allowMissing && response.status === 404) return null;
    if (response.status === 204) return {};
    const data = await response.json();
    if (!response.ok) throw new Error('GitHub ' + response.status + ': ' + (data.message || 'Request failed'));
    return data;
  };
  const path = '/repos/' + repo;
  if (process.env.CONTRIBUTION_MODE === 'cleanup') { const result = await cleanup(event,repo,api); console.log('Removed ' + result.removed + ' retired contribution branches.'); return; }
  if (process.env.CONTRIBUTION_MODE === 'setup') {
    if (!await api('GET',path + '/labels/dictionary-approved',null,true)) await api('POST',path + '/labels',{name:'dictionary-approved',color:'2e7566',description:'Maintainer-reviewed vocabulary ready to prepare as a pull request'});
    console.log('Contribution review label is ready.'); return;
  }
  let result, failure;
  try { result = await stage(event,repo,api); } catch (error) { failure = error; }
  const number = event.issue?.number;
  if (Number.isSafeInteger(number)) {
    const marker = '<!-- bk-contribution-review -->';
    const body = marker + '\n' + (failure ? 'This proposal could not be prepared: ' + failure.message + '\n\nUpdate the proposal or reload the contributor editor, then ask a maintainer to apply dictionary-approved again.' : result.unchanged ? 'This proposal matches the current entry. No dictionary changes are needed.' : 'The reviewed change is ready. [Open its pull request](' + result.url + '), review the entry, and wait for **Site checks** to pass before merging. The live dictionary is unchanged until that merge.\n\nIf the dictionary changes while this is being reviewed, reapply dictionary-approved to prepare it against the latest source.');
    const comments = await api('GET',path + '/issues/' + number + '/comments?per_page=100');
    const previous = comments.find(comment => comment.user?.login === 'github-actions[bot]' && comment.body?.includes(marker));
    if (previous) await api('PATCH',path + '/issues/comments/' + previous.id,{body});
    else await api('POST',path + '/issues/' + number + '/comments',{body});
    await api('DELETE',path + '/issues/' + number + '/labels/dictionary-approved',null,true);
  }
  if (failure) throw failure;
  console.log(result.unchanged ? 'No source changes needed.' : 'Contribution prepared for maintainer review.');
}
module.exports = { helpers, loadCorpus, isMaintainer, compareUrl, stage, cleanup };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
