/* Shared collection adapters. Existing Tutong IDs stay unchanged for progress backups. */
(() => {
  'use strict';
  const names = Object.freeze({ all: 'All languages', tutong: 'Bahasa Tutong', brunei: 'Melayu Brunei', dusun: 'Dusun Brunei' });
  const statuses = Object.freeze({ existing: 'Existing collection', reviewed: 'Community checked', source: 'Source recorded · needs review', research: 'Source recorded · needs review', draft: 'Needs review', needs_review: 'Needs review' });
  const phraseIds = new Set(['brunei-053', 'brunei-144']);
  const reservedId = 1000000;
  function progressId(language, sourceId) {
    let hash = 14695981039346656037n;
    for (const character of language + ':' + sourceId) hash = ((hash ^ BigInt(character.codePointAt(0))) * 1099511628211n) & ((1n << 52n) - 1n);
    return Number(hash) + reservedId;
  }
  const statusLabel = status => statuses[status] || 'Needs review';
  const select = (entries, collection = 'all') => entries.filter(entry => collection === 'all' || entry.language === collection);
  const categoryNames = Object.freeze({
    'Fruits': 'Food & Drink', 'Family & People': 'People', 'Kata ganti nama / diri': 'Pronouns', 'Kata ganti nama tunjuk': 'Pronouns',
    'Perkataan asas': 'Everyday Words', 'Kosa kata asas': 'Everyday Words', 'Kosa kata tambahan (kajian fonetik)': 'Everyday Words',
    'Perbandingan ejaan': 'Language & Culture', 'Sebutan wilayah': 'Language & Culture', 'Kata berimbuhan': 'Word Forms', 'Istilah budaya': 'Language & Culture', 'Istilah bahasa': 'Language & Culture'
  });
  const categoryName = category => categoryNames[category] || category || 'Other';
  function adapt(entry, language) {
    const examples = entry.examples || (entry.status === 'reviewed' ? (entry.usageExamples || []).map(example => ({ text: example.text, explanation: example.userExplanation, status:'reviewed', credit:'Maintainer’s recorded example' })) : []);
    return { ...entry, examples, id: progressId(language, entry.id), sourceId: entry.id, language, tutong: entry.headword, malay: entry.standardMalay || '', english: entry.english || '', cat: categoryName(entry.category), sourceCategory: entry.category || 'Other', notation: '', note: [entry.reviewNote, entry.usageNotes].filter(Boolean).join(' ') };
  }
  function interleave(groups) {
    const result = [];
    for (let index = 0; index < Math.max(0, ...groups.map(group => group.length)); index++) for (const group of groups) if (group[index]) result.push(group[index]);
    return result;
  }
  function numberGroups(entries, language) {
    const groups = new Map();
    for (const entry of entries) {
      if (!Number.isSafeInteger(entry.number) || entry.number < 1) continue;
      if (!groups.has(entry.number)) groups.set(entry.number, []);
      groups.get(entry.number).push(entry);
    }
    return [...groups].sort((a, b) => a[0] - b[0]).map(([number, records]) => ({
      number, language, word: [...new Set(records.map(record => record.headword))].join(' / '), records,
      status: records.every(record => record.status === 'reviewed') ? 'reviewed' : records.some(record => ['needs_review', 'draft'].includes(record.status)) ? 'needs_review' : 'source',
      note: [...new Set(records.map(record => record.reviewNote).filter(Boolean))].join(' ')
    }));
  }
  function countingStages(entries) {
    return [
      { id:'basics', title:'Basics: 1–10', intro:'Begin with the small numbers. Read each form, then try a short recall check.', entries:entries.filter(entry => entry.number <= 10) },
      { id:'building', title:'Building numbers: teens & tens', intro:'Compare recorded teens and tens, and notice what changes when another unit is added.', entries:entries.filter(entry => entry.number > 10 && entry.number < 100) },
      { id:'milestones', title:'Larger milestones: 100 & 1,000', intro:'Use these larger values as landmarks as you become familiar with counting.', entries:entries.filter(entry => entry.number >= 100) }
    ].filter(stage => stage.entries.length);
  }
  function countingPairs(entries) {
    return entries.filter(entry => entry.number >= 20 && entry.number < 100 && entry.number % 10 === 0).flatMap(entry => {
      const next = entries.find(item => item.number === entry.number + 1);
      return next ? [[entry, next]] : [];
    });
  }
  // Explicitly disputed readings stay visible in the reference but outside scored exercises.
  const countingPracticePool = entries => entries.filter(entry => !['needs_review','draft'].includes(entry.status));
  function build({ words, phrases, numbers, brunei = [], dusun = [] }) {
    const tutongWords = words.map(word => ({ ...word, cat: categoryName(word.cat), sourceCategory: word.cat, language: 'tutong', sourceId: 'tutong-' + word.id, status: 'existing' }));
    const bruneiWords = brunei.map(word => adapt(word, 'brunei')), dusunWords = dusun.map(word => adapt(word, 'dusun'));
    const dictionary = interleave([tutongWords, bruneiWords, dusunWords]);
    if (new Set(dictionary.map(word => word.id)).size !== dictionary.length) throw new Error('Duplicate collection or progress IDs.');
    const phrasebook = interleave([
      phrases.map(phrase => ({ ...phrase, language: 'tutong', sourceId: 'tutong-phrase-' + phrase.id, status: 'existing' })),
      bruneiWords.filter(word => phraseIds.has(word.sourceId)).map(word => ({ ...word, cat: 'Expressions' })),
      dusunWords.filter(word => word.cat === 'Greetings')
    ]);
    const counting = {
      tutong: numbers.map(([number, word]) => ({ number, word, language: 'tutong', status: 'existing', records: [], note: '' })),
      brunei: numberGroups(brunei, 'brunei'), dusun: numberGroups(dusun, 'dusun')
    };
    return { words: dictionary, phrases: phrasebook, numbers: counting };
  }
  let pending;
  const listeners = new Set(), snapshot = { brunei: [], dusun: [], failed: [], loaded: [] };
  function load(onChange) {
    if (onChange) { listeners.add(onChange); onChange({ ...snapshot }); }
    if (!pending) pending = Promise.all(['brunei', 'dusun'].map(async language => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch('data/' + language + '.json', { signal: controller.signal });
        if (!response.ok) throw new Error('Collection unavailable');
        const data = await response.json();
        if (!Array.isArray(data) || new Set(data.map(entry => entry?.id)).size !== data.length || !data.every(entry => typeof entry.id === 'string' && entry.language === language && typeof entry.headword === 'string' && typeof entry.standardMalay === 'string' && typeof entry.english === 'string')) throw new Error('Invalid collection');
        return { language, data };
      } catch { return { language, data: [], failed: true }; }
      finally { clearTimeout(timer); }
    }).map(task => task.then(result => {
      snapshot[result.language] = result.data; snapshot.loaded = [...snapshot.loaded, result.language];
      if (result.failed) snapshot.failed = [...snapshot.failed, result.language];
      for (const listener of listeners) listener({ ...snapshot });
      return result;
    }))).then(() => { listeners.clear(); return { ...snapshot }; });
    else pending.then(() => listeners.delete(onChange));
    return pending;
  }
  globalThis.BKCollections = Object.freeze({ names, statusLabel, categoryName, progressId, reservedId, select, numberGroups, countingStages, countingPairs, countingPracticePool, build, load });
})();
