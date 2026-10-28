/* Pure helpers shared by the site, contributor editor and regression tests. */
(() => {
  const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'\x60]/g, '').trim();
  function dayKey(date = new Date()) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function dateForKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [year, month, day] = key.split('-').map(Number), date = new Date(year, month - 1, day, 12);
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
    const seen = new Set([normalize(word.english)]), choices = [word];
    for (const candidate of shuffle(pool, random)) {
      const meaning = normalize(candidate.english);
      if (!meaning || seen.has(meaning) || normalize(candidate.tutong) === normalize(word.tutong)) continue;
      seen.add(meaning); choices.push(candidate);
      if (choices.length === 4) break;
    }
    return shuffle(choices, random);
  }
  const aliases = value => normalize(value).split(/\s*\/\s*/).filter(Boolean);
  function editDistance(left, right, limit = 2) {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index), before = null;
    for (let i = 1; i <= left.length; i++) {
      const row = [i];
      for (let j = 1; j <= right.length; j++) {
        row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
        if (before && i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
      }
      before = previous; previous = row;
    }
    return previous[right.length];
  }
  function findWords(words, { query = '', category = 'All', savedOnly = false, saved = new Set(), sort = 'default', language = 'all', fuzzy = true } = {}) {
    const q = normalize(query), tokens = q.split(/\s+/).filter(Boolean);
    const fields = ['tutong', 'malay', 'english'].includes(language) ? [language] : ['tutong', 'malay', 'english', 'note'];
    const pool = words.filter(word => (category === 'All' || word.cat === category) && (!savedOnly || saved.has(word.id)));
    let ranked = pool.map((word, index) => {
      let score = q ? 0 : 1;
      const values = fields.flatMap(field => aliases(word[field]).map(text => ({ text, field })));
      if (q) for (const { text, field } of values) {
        const weight = field === 'note' ? 0 : field === 'tutong' ? 6 : field === 'malay' ? 4 : 2;
        const value = text === q ? 100 : text.startsWith(q) ? 75 : text.includes(q) ? 55 : tokens.every(token => text.includes(token)) ? 40 : 0;
        score = Math.max(score, value ? (field === 'note' ? Math.min(value, 25) : value + weight) : 0);
      }
      return { word, index, score };
    }).filter(item => item.score > 0);
    let approximate = false;
    if (!ranked.length && fuzzy && q.length >= 3 && q.length <= 80) {
      approximate = true;
      const limit = q.length < 6 ? 1 : 2;
      ranked = pool.map((word, index) => {
        const values = fields.filter(field => field !== 'note').flatMap(field => aliases(word[field]));
        let distance = limit + 1;
        for (const text of values) {
          distance = Math.min(distance, editDistance(q, text, limit));
          if (!q.includes(' ')) for (const token of text.split(/\s+/)) distance = Math.min(distance, editDistance(q, token, limit));
        }
        return { word, index, score: limit + 1 - distance };
      }).filter(item => item.score > 0);
    }
    if (sort === 'az') ranked.sort((a, b) => a.word.tutong.localeCompare(b.word.tutong));
    else if (sort === 'english') ranked.sort((a, b) => a.word.english.localeCompare(b.word.english));
    else ranked.sort((a, b) => b.score - a.score || a.index - b.index);
    return { results: ranked.map(item => item.word), approximate: approximate && ranked.length > 0 };
  }
  const searchWords = (words, options) => findWords(words, options).results;
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
  const unique = values => [...new Set(values)];
  function cleanProgress(data, lessonSize = 8) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The backup has no progress data.');
    for (const field of ['saved', 'learned']) {
      if (!Array.isArray(data[field]) || data[field].length > 50000 || !data[field].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Invalid ' + field + ' words in backup.');
    }
    if (!Array.isArray(data.days) || data.days.length > 5000 || !data.days.every(day => typeof day === 'string' && dateForKey(day))) throw new Error('Invalid practice dates in backup.');
    if (!Number.isInteger(data.lessonIndex) || data.lessonIndex < 0 || data.lessonIndex >= lessonSize) throw new Error('Invalid lesson position in backup.');
    if (!['day', 'night'].includes(data.theme)) throw new Error('Invalid theme in backup.');
    return { saved: unique(data.saved), learned: unique(data.learned), days: unique(data.days).sort(), lessonIndex: data.lessonIndex, theme: data.theme };
  }
  function createProgressBackup(data, date = new Date()) {
    return { app: 'bahasa-kitani', version: 1, exportedAt: date.toISOString(), data: cleanProgress(data) };
  }
  function parseProgressBackup(text, lessonSize = 8) {
    if (typeof text !== 'string' || text.length > 1000000) throw new Error('Choose a Bahasa Kitani backup smaller than 1 MB.');
    let file;
    try { file = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a Bahasa Kitani progress backup.'); }
    if (file?.app !== 'bahasa-kitani' || file?.version !== 1) throw new Error('This is not a supported Bahasa Kitani progress backup.');
    return { ...file, data: cleanProgress(file.data, lessonSize) };
  }
  function restoreProgress(current, incoming, { mode = 'merge', validIds, lessonSize = 8 } = {}) {
    if (!['merge', 'replace'].includes(mode)) throw new Error('Choose merge or replace.');
    const old = cleanProgress(current, lessonSize), next = cleanProgress(incoming, lessonSize);
    const missing = unique([...next.saved, ...next.learned]).filter(id => validIds && !validIds.has(id)).length;
    const ids = values => unique(values).filter(id => !validIds || validIds.has(id));
    const data = mode === 'merge' ? {
      saved: ids([...old.saved, ...next.saved]), learned: ids([...old.learned, ...next.learned]),
      days: unique([...old.days, ...next.days]).sort(), lessonIndex: Math.max(old.lessonIndex, next.lessonIndex), theme: old.theme
    } : { ...next, saved: ids(next.saved), learned: ids(next.learned) };
    return { data, missing };
  }
  globalThis.BK = Object.freeze({ normalize, aliases, dayKey, dateForKey, streak, shuffle, choicesFor, editDistance, findWords, searchWords, storage, nextEntryId, createProgressBackup, parseProgressBackup, restoreProgress });
})();
