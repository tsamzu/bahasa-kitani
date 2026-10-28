(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const store = BK.storage(() => window.localStorage);
  const corpus = { words: WORDS, phrases: PHRASES, categories: CATEGORIES };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const draftKey = 'bk-contributions-v1', counters = {};
  let drafts = store.read(draftKey, [], value => Array.isArray(value) && value.length <= 100).filter(item => item && typeof item.key === 'string' && /^[\w-]{1,100}$/.test(item.key) && item.proposal);
  let selected = null, original = null, allocated = null, current = null;
  const kind = () => $('#entry-kind').value;
  const entries = () => kind() === 'word' ? WORDS : PHRASES;
  const counterKey = () => kind() === 'word' ? 'bk_next_id' : 'bk_next_phrase_id';
  const nextId = () => BK.nextEntryId(entries(), counters[counterKey()] ?? store.read(counterKey(), 0, Number.isSafeInteger));
  function status(text) { $('#entry-status').textContent = text; }
  function categories(value = '') {
    const items = kind() === 'word' ? [...new Set([...CATEGORIES, ...WORDS.map(word => word.cat)])].filter(item => item !== 'All') : [...new Set(PHRASES.map(item => item.cat))];
    $('#entry-category').innerHTML = '<option value="">Choose a category</option>' + items.map(item => '<option value="' + esc(item) + '">' + esc(item) + '</option>').join('');
    $('#entry-category').value = value; $('#word-fields').hidden = kind() !== 'word'; $('#next-entry-id').textContent = nextId();
  }
  function clearPreview() {
    current = null; $('#entry-preview').hidden = true; $('#preview-placeholder').hidden = false;
    $('#entry-output').value = ''; $('#copy-entry').disabled = true; $('#submit-proposal').hidden = true;
  }
  function reset(type = 'word') {
    $('#entry-form').reset(); $('#entry-kind').value = type; selected = null; original = null; allocated = null;
    categories(); clearPreview(); $('#editor-mode').textContent = 'New entry'; $('#entry-id-label').textContent = 'New ' + kind();
    $('#duplicate-warning').hidden = true; status('Fill in the entry, then save a draft or generate code.'); renderDrafts();
  }
  function readForm() {
    if (!$('#entry-form').reportValidity()) return null;
    if (!allocated) {
      allocated = original?.id || nextId();
      if (!original) { counters[counterKey()] = allocated + 1; store.write(counterKey(), allocated + 1); }
      $('#next-entry-id').textContent = nextId();
    }
    const entry = { id: allocated, tutong: $('#entry-tutong').value.trim(), malay: $('#entry-malay').value.trim(), english: $('#entry-english').value.trim(), cat: $('#entry-category').value };
    if (kind() === 'word') { entry.notation = $('#entry-notation').value; entry.note = $('#entry-note').value.trim(); }
    return BKC.validateProposal({ app:'bahasa-kitani-contribution', version:1, kind:kind(), action:original ? 'update' : 'add', entry, ...(original ? { original } : {}) }, corpus);
  }
  function preview(proposal) {
    current = proposal;
    for (const field of ['tutong', 'malay', 'english']) $('#preview-' + field).textContent = proposal.entry[field];
    $('#preview-note').textContent = proposal.entry.note || proposal.entry.cat;
    $('#entry-preview').hidden = false; $('#preview-placeholder').hidden = true;
    $('#entry-output').value = BKC.formatEntry(proposal.entry, proposal.kind); $('#copy-entry').disabled = false;
    $('#submit-proposal').hidden = true;
    try { $('#submit-proposal').href = BKC.issueUrl(proposal); $('#submit-proposal').hidden = false; }
    catch (error) { status(error.message); }
  }
  function save(proposal) {
    const key = selected || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    const item = { key, updatedAt:new Date().toISOString(), proposal };
    drafts = [item, ...drafts.filter(draft => draft.key !== key)].slice(0,100); selected = key;
    const persisted = store.write(draftKey, drafts); renderDrafts();
    return persisted;
  }
  function renderDrafts() {
    $('#draft-count').textContent = drafts.length + (drafts.length === 1 ? ' draft' : ' drafts');
    $('#draft-list').innerHTML = drafts.length ? drafts.map(item => '<div class="draft-row ' + (selected === item.key ? 'active' : '') + '"><button class="draft-open" type="button" data-draft="' + esc(item.key) + '"><strong>' + esc(item.proposal.entry?.tutong || 'Untitled') + '</strong><small>' + esc(item.proposal.action === 'update' ? 'Correction' : 'New ' + item.proposal.kind) + ' · saved locally</small></button><button class="draft-remove" type="button" data-remove="' + esc(item.key) + '" aria-label="Remove draft ' + esc(item.proposal.entry?.tutong || '') + '">Remove</button></div>').join('') : '<p class="local-note">No saved drafts yet.</p>';
    $('#draft-list').querySelectorAll('[data-draft]').forEach(button => button.addEventListener('click', () => load(drafts.find(item => item.key === button.dataset.draft))));
    $('#draft-list').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
      drafts = drafts.filter(item => item.key !== button.dataset.remove); store.write(draftKey, drafts);
      if (selected === button.dataset.remove) reset(kind()); else renderDrafts();
      status('Draft removed from this browser. Published entries are unchanged.');
    }));
  }
  function load(item) {
    if (!item?.proposal?.entry) return;
    const proposal = item.proposal; $('#entry-kind').value = proposal.kind === 'phrase' ? 'phrase' : 'word';
    original = proposal.action === 'update' ? proposal.original : null; selected = item.key; allocated = proposal.entry.id || null;
    categories(proposal.entry.cat);
    for (const field of ['tutong','malay','english','notation','note']) if ($('#entry-' + field)) $('#entry-' + field).value = proposal.entry[field] || '';
    $('#editor-mode').textContent = original ? 'Edit existing entry' : 'Draft entry';
    $('#entry-id-label').textContent = (original ? 'Editing #' : 'Draft #') + allocated;
    renderDrafts(); duplicateCheck();
    try { preview(BKC.validateProposal(proposal, corpus)); status('Draft loaded. Review your changes before continuing.'); }
    catch (error) { clearPreview(); status(error.message); }
  }
  function editEntry(entry) {
    reset(kind()); original = JSON.parse(JSON.stringify(entry)); allocated = entry.id;
    categories(entry.cat);
    for (const field of ['tutong','malay','english','notation','note']) if ($('#entry-' + field)) $('#entry-' + field).value = entry[field] || '';
    $('#editor-mode').textContent = 'Edit existing entry'; $('#entry-id-label').textContent = 'Editing #' + entry.id;
    status('Editing an existing entry. Its ID stays the same; save your correction as a draft.');
    $('#entry-tutong').focus(); duplicateCheck();
  }
  function duplicateCheck() {
    const spellings = BK.aliases($('#entry-tutong').value), matches = entries().filter(entry => entry.id !== original?.id && BK.aliases(entry.tutong).some(text => spellings.includes(text))).slice(0,4);
    $('#duplicate-warning').hidden = !matches.length;
    $('#duplicate-warning').textContent = matches.length ? 'This spelling already appears in: ' + matches.map(entry => entry.tutong + ' — ' + entry.english + ' (#' + entry.id + ')').join('; ') + '. Check whether you should edit that entry or add a different meaning.' : '';
  }
  function searchExisting() {
    const query = $('#existing-search').value.trim();
    const found = query ? BK.findWords(entries(), { query }) : { results:[], approximate:false };
    const results = found.results.slice(0,8);
    $('#existing-summary').textContent = !query ? 'Search here to edit an existing entry.' : found.approximate ? 'Closest spelling matches. Choose the correct entry.' : found.results.length + ' matches; showing up to 8.';
    $('#existing-results').innerHTML = results.map(entry => '<div class="editor-result"><button type="button" data-edit="' + entry.id + '"><strong>' + esc(entry.tutong) + '</strong><small>' + esc(entry.malay) + ' · ' + esc(entry.english) + ' · Edit #' + entry.id + '</small></button></div>').join('');
    $('#existing-results').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editEntry(entries().find(entry => entry.id === Number(button.dataset.edit)))));
  }
  $('#entry-kind').addEventListener('change', () => { const type = kind(); reset(type); searchExisting(); });
  $('#new-entry').addEventListener('click', () => reset(kind()));
  $('#existing-search').addEventListener('input', searchExisting);
  $('#entry-form').addEventListener('input', () => { clearPreview(); duplicateCheck(); status('Changes are not saved yet. Save your draft when ready.'); });
  $('#entry-form').addEventListener('submit', event => {
    event.preventDefault();
    try { const proposal = readForm(); if (!proposal) return; preview(proposal); const persisted = save(proposal); status(persisted ? 'Draft saved in this browser. Review the preview, then continue on GitHub when ready.' : 'Draft kept for this visit. Browser storage is unavailable; copy the entry before leaving.'); }
    catch (error) { status(error.message); }
  });
  $('#generate-entry').addEventListener('click', () => {
    try { const proposal = readForm(); if (!proposal) return; preview(proposal); $('#code-export').open = true; status('Entry generated with dictionary-style field names. Save a draft to keep it.'); }
    catch (error) { status(error.message); }
  });
  $('#submit-proposal').addEventListener('click', event => {
    try { if (!current) { event.preventDefault(); return; } save(current); }
    catch (error) { event.preventDefault(); status(error.message); }
  });
  $('#copy-entry').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#entry-output').value); status('Entry copied. Review before manual publishing.'); }
    catch { $('#entry-output').focus(); $('#entry-output').select(); status('Text selected. Use your browser’s Copy command.'); }
  });
  categories(); renderDrafts();
})();
