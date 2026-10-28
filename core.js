/* Shared browser logic, also exercised by the Node test suite. */
(() => {
  const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'`]/g, '').trim();
  function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function dateForKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return dayKey(date) === key ? date : null;
  }
  function streak(days, now = new Date()) {
    const keys = new Set(days.filter(key => dateForKey(key)));
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    if (!keys.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (keys.has(dayKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  }
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const target = Math.floor(random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }
  function choicesFor(word, pool, random = Math.random) {
    const seen = new Set([normalize(word.english)]);
    const choices = [word];
    for (const candidate of shuffle(pool, random)) {
      const meaning = normalize(candidate.english);
      if (!meaning || seen.has(meaning) || normalize(candidate.tutong) === normalize(word.tutong)) continue;
      seen.add(meaning); choices.push(candidate);
      if (choices.length === 4) break;
    }
    return shuffle(choices, random);
  }
  function searchWords(words, { query = '', category = 'All', savedOnly = false, saved = new Set(), sort = 'default' } = {}) {
    const q = normalize(query);
    const results = words.filter(word => (category === 'All' || word.cat === category) && (!savedOnly || saved.has(word.id)) && (!q || [word.tutong, word.malay, word.english, word.note].some(value => normalize(value).includes(q))));
    if (sort === 'az') results.sort((a, b) => a.tutong.localeCompare(b.tutong));
    if (sort === 'english') results.sort((a, b) => a.english.localeCompare(b.english));
    return results;
  }
  function storage(access) {
    let available = true;
    return {
      get available() { return available; },
      read(key, fallback, validate = () => true) {
        try { const raw = access().getItem(key); if (raw === null) return fallback; const value = JSON.parse(raw); return validate(value) ? value : fallback; }
        catch { available = false; return fallback; }
      },
      write(key, value) {
        try { access().setItem(key, JSON.stringify(value)); return true; }
        catch { available = false; return false; }
      }
    };
  }
  function nextEntryId(entries, counter) {
    const minimum = entries.reduce((highest, entry) => Math.max(highest, entry.id), 0) + 1;
    return Number.isSafeInteger(counter) && counter >= minimum ? counter : minimum;
  }
  globalThis.BK = Object.freeze({ normalize, dayKey, dateForKey, streak, shuffle, choicesFor, searchWords, storage, nextEntryId });
})();
