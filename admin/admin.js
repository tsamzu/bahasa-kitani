(() => {
  const $ = selector => document.querySelector(selector);
  const store = BK.storage(() => window.localStorage);
  const counters = {};
  const kind = () => $('#entry-kind').value;
  const entries = () => kind() === 'word' ? WORDS : PHRASES;
  const counterKey = () => kind() === 'word' ? 'bk_next_id' : 'bk_next_phrase_id';
  function nextId() { const key = counterKey(); return BK.nextEntryId(entries(), counters[key] ?? store.read(key, 0, Number.isSafeInteger)); }
  function updateKind() {
    $('#word-fields').hidden = kind() !== 'word';
    $('#next-entry-id').textContent = nextId();
    const categories = kind() === 'word' ? CATEGORIES.filter(category => category !== 'All') : [...new Set(PHRASES.map(phrase => phrase.cat))];
    $('#entry-category').replaceChildren(...categories.map(category => { const option = document.createElement('option'); option.value = category; option.textContent = category; return option; }));
  }
  $('#entry-kind').addEventListener('change', updateKind);
  $('#entry-form').addEventListener('submit', event => {
    event.preventDefault();
    const entry = { id: nextId(), tutong: $('#entry-tutong').value.trim(), malay: $('#entry-malay').value.trim(), english: $('#entry-english').value.trim(), cat: $('#entry-category').value };
    if (!entry.tutong || !entry.malay || !entry.english) { $('#entry-status').textContent = 'Fill in Tutong, Malay and English.'; return; }
    if (kind() === 'word') { entry.notation = $('#entry-notation').value; entry.note = $('#entry-note').value.trim(); }
    $('#entry-output').value = '  ' + JSON.stringify(entry) + ',';
    counters[counterKey()] = entry.id + 1; store.write(counterKey(), entry.id + 1);
    $('#next-entry-id').textContent = nextId(); $('#copy-entry').disabled = false;
    $('#entry-status').textContent = `Entry ${entry.id} generated. Review it before copying.`;
  });
  $('#copy-entry').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#entry-output').value); $('#entry-status').textContent = 'Copied. Review and paste into the correct data array on GitHub.'; }
    catch { $('#entry-output').focus(); $('#entry-output').select(); $('#entry-status').textContent = 'Text selected. Use your browser’s Copy command.'; }
  });
  updateKind();
})();
