/* Shared validation and source formatting. No credentials or network access. */
(() => {
  const keys = kind => kind === 'phrase' ? ['id', 'tutong', 'malay', 'english', 'cat'] : ['id', 'tutong', 'malay', 'english', 'cat', 'notation', 'note'];
  const formatEntry = (entry, kind = 'word') => '  { ' + keys(kind).map(key => key + ':' + JSON.stringify(entry[key] ?? '')).join(', ') + ' },';
  const signature = (entry, kind) => JSON.stringify(keys(kind).map(key => entry[key] ?? ''));
  function validateProposal(proposal, corpus) {
    if (proposal?.app !== 'bahasa-kitani-contribution' || proposal.version !== 1) throw new Error('Unsupported contribution format.');
    if (!['word', 'phrase'].includes(proposal.kind) || !['add', 'update'].includes(proposal.action)) throw new Error('Choose a word or phrase and a valid action.');
    const list = proposal.kind === 'word' ? corpus.words : corpus.phrases, source = proposal.entry;
    if (!source || typeof source !== 'object') throw new Error('An entry is required.');
    const entry = {};
    for (const field of ['tutong', 'malay', 'english', 'cat']) {
      if (typeof source[field] !== 'string' || !source[field].trim() || source[field].length > 500) throw new Error('Fill in ' + field + ' (up to 500 characters).');
      entry[field] = source[field].trim();
    }
    const categories = new Set(list.map(item => item.cat));
    if (proposal.kind === 'word') for (const category of corpus.categories || []) if (category !== 'All') categories.add(category);
    if (!categories.has(entry.cat)) throw new Error('Choose an existing category.');
    if (proposal.kind === 'word') {
      if (!['', 'variant', 'loanword', 'clarify'].includes(source.notation ?? '')) throw new Error('Choose a valid notation.');
      if (typeof (source.note ?? '') !== 'string' || (source.note || '').length > 1500) throw new Error('Notes must be under 1,500 characters.');
      entry.notation = source.notation || ''; entry.note = (source.note || '').trim();
    }
    if (proposal.action === 'update') {
      if (!Number.isSafeInteger(source.id)) throw new Error('The original entry ID is missing.');
      const existing = list.find(item => item.id === source.id);
      if (!existing) throw new Error('This entry no longer exists. Reload the dictionary before editing.');
      if (!proposal.original || signature(existing, proposal.kind) !== signature(proposal.original, proposal.kind)) throw new Error('This entry changed since you opened it. Reload and review the latest entry.');
      entry.id = source.id;
    } else if (Number.isSafeInteger(source.id) && source.id > 0) entry.id = source.id;
    const duplicate = list.find(item => item.id !== (proposal.action === 'update' ? entry.id : -1) && ['tutong', 'malay', 'english'].every(field => BK.normalize(item[field]) === BK.normalize(entry[field])));
    if (duplicate) throw new Error('This word and its translations already exist as entry ' + duplicate.id + '. Edit that entry instead.');
    return { app: 'bahasa-kitani-contribution', version: 1, kind: proposal.kind, action: proposal.action, entry, ...(proposal.action === 'update' ? { original: proposal.original } : {}) };
  }
  const fence = String.fromCharCode(96).repeat(3);
  function issueUrl(proposal) {
    const body = 'Please review this ' + proposal.kind + ' ' + (proposal.action === 'add' ? 'addition' : 'correction') + '.\n\n'
      + '<!-- bahasa-kitani-proposal -->\n' + fence + 'json\n' + JSON.stringify(proposal, null, 2) + '\n' + fence + '\n\n'
      + 'Maintainer: check the translations, then add the dictionary-approved label to prepare a reviewed change.';
    const url = new URL('https://github.com/tsamzu/bahasa-kitani/issues/new');
    url.searchParams.set('title', '[Dictionary] ' + (proposal.action === 'add' ? 'Add ' : 'Update ') + proposal.entry.tutong);
    url.searchParams.set('body', body);
    if (url.href.length > 7500) throw new Error('This entry is too long for the GitHub review link. Shorten the note, or use the code export.');
    return url.href;
  }
  function proposalFromBody(body) {
    if (typeof body !== 'string' || body.length > 20000) throw new Error('Invalid contribution body.');
    const expression = new RegExp('<!-- bahasa-kitani-proposal -->\\s*' + fence + 'json\\s*\\n([\\s\\S]*?)\\n' + fence + '\\s*(?:\\n|$)');
    const match = body.match(expression);
    if (!match) throw new Error('Use the contributor editor to create the proposal.');
    try { return JSON.parse(match[1]); } catch { throw new Error('The contribution contains invalid JSON.'); }
  }
  function applyToSource(source, proposal, corpus, reserved = []) {
    const clean = validateProposal(proposal, corpus), list = clean.kind === 'word' ? corpus.words : corpus.phrases;
    const entry = { ...clean.entry };
    if (clean.action === 'add') entry.id = BK.nextEntryId([...list, ...reserved.map(id => ({ id }))]);
    const name = clean.kind === 'word' ? 'WORDS' : 'PHRASES';
    const expression = new RegExp('(const ' + name + ' = \\[)([\\s\\S]*?)(\\n\\];)');
    const block = source.match(expression);
    if (!block) throw new Error('The dictionary source layout needs maintainer review.');
    const line = formatEntry(entry, clean.kind);
    let content = block[2];
    if (clean.action === 'add') content = content.replace(/\s*$/, '') + '\n' + line;
    else {
      const row = new RegExp('^[\\t ]*\\{[\\t ]*(?:"id"|id)[\\t ]*:[\\t ]*' + entry.id + '[\\t ]*,[^\\n]*\\},?[\\t ]*$', 'm');
      if (!row.test(content)) throw new Error('This entry needs manual source review.');
      content = content.replace(row, () => line);
    }
    const updated = source.replace(expression, () => block[1] + content + block[3]);
    return { source: updated, entry, changed: clean.action === 'add' || signature(list.find(item => item.id === entry.id), clean.kind) !== signature(entry, clean.kind) };
  }
  globalThis.BKC = Object.freeze({ formatEntry, signature, validateProposal, issueUrl, proposalFromBody, applyToSource });
})();
