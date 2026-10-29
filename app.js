(async () => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  if (typeof WORDS === 'undefined' || !Array.isArray(WORDS) || !WORDS.length || typeof BK === 'undefined' || typeof BKCollections === 'undefined') {
    $('#app-error').hidden = false;
    return;
  }
  const extra = await BKCollections.load();
  const catalog = BKCollections.build({ words: WORDS, phrases: PHRASES, numbers: NUMBERS, brunei: extra.brunei, dusun: extra.dusun });
  const isCollection = value => Object.hasOwn(BKCollections.names, value);
  const store = BK.storage(() => window.localStorage);
  const validIds = new Set(catalog.words.map(word => word.id));
  const loadStatus = $('#collections-load-status');
  loadStatus.hidden = !extra.failed.length;
  if (extra.failed.length) {
    loadStatus.textContent = extra.failed.map(language => BKCollections.names[language]).join(' and ') + ' could not load. The available collections still work. Reload this page to try again.';
  }
  function setCollection(collection) {
    if (!isCollection(collection)) return;
    if (collection !== state.collection) { state.dictionaryCategory = 'All'; state.dictionaryPage = 1; state.phraseCategory = 'All'; }
    state.collection = collection;
    for (const name of ['dictionary', 'phrase', 'numbers']) $('#' + name + '-collection').value = collection;
  }
  function entryDetails(word) {
    const source = word.sourceFile || '', links = [];
    if (word.sourceUrl && /^https:\/\//.test(word.sourceUrl)) links.push('<a href="' + esc(word.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Read original source ↗</a>');
    for (const item of word.additionalSources || []) if (/^https:\/\//.test(item.url || '')) links.push('<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.name || 'Additional source') + ' ↗</a>');
    if (!word.note && !source && !links.length) return '';
    return '<details class="entry-note"><summary>' + (source ? 'Notes & sources' : 'Entry note') + '</summary>' + (word.note ? '<p>' + esc(word.note) + '</p>' : '') + (source ? '<p>Source: ' + esc(source) + (word.journalPage ? ' · p. ' + esc(word.journalPage) : '') + '</p>' : '') + links.map(link => '<p>' + link + '</p>').join('') + '</details>';
  }
  function languageLabel(word) { return '<span class="collection-label ' + word.language + '">' + esc(BKCollections.names[word.language]) + '</span>'; }
  function statusLabel(word) { return '<span class="review-label ' + esc(word.status) + '">' + esc(BKCollections.statusLabel(word.status)) + '</span>'; }
  const idList = value => Array.isArray(value) && value.every(Number.isInteger);
  const daysList = value => Array.isArray(value) && value.every(key => typeof key === 'string' && BK.dateForKey(key));
  const lessonWords = [735, 733, 306, 159, 49, 117, 149, 150].map(id => WORDS.find(word => word.id === id)).filter(Boolean);
  const state = {
    route: 'home', collection: 'all', dictionaryCategory: 'All', dictionaryPage: 1, savedOnly: false, dictionaryLanguage: 'all',
    saved: new Set(store.read('bk-saved', [], idList).filter(id => validIds.has(id) || (extra.failed.length && id >= BKCollections.reservedId))),
    learned: new Set(store.read('bk-learned', [], idList).filter(id => validIds.has(id))),
    days: store.read('bk-days', [], daysList),
    lessonIndex: store.read('bk-lesson-index', 0, value => Number.isInteger(value) && value >= 0 && value < lessonWords.length),
    revealed: false, phraseCategory: 'All', numbersHidden: false,
    lessonMode: 'cards', quizWords: [], quizIndex: 0, quizAnswers: [], quizAnswered: false
  };
  const routes = ['home', 'learn', 'dictionary', 'phrases', 'numbers', 'community'];
  const legacyRoutes = { 'numbers-sec': 'numbers', previews: 'dictionary', 'dict-preview': 'dictionary', 'body-preview': 'dictionary', 'animals-preview': 'dictionary', 'food-preview': 'dictionary', phrasebook: 'phrases', feedback: 'community' };
  let dailyWord;
  function persist() {
    store.write('bk-saved', [...state.saved]); store.write('bk-learned', [...state.learned]);
    store.write('bk-lesson-index', state.lessonIndex); updateProgress();
  }
  function toast(message) {
    const element = $('#toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
  }
  function markToday() {
    state.days = [...new Set([...state.days, BK.dayKey()])].sort().slice(-370);
    store.write('bk-days', state.days); updateProgress();
  }
  function updateProgress() {
    const done = lessonWords.filter(word => state.learned.has(word.id)).length;
    const percent = Math.round(done / lessonWords.length * 100) || 0;
    $('#learned-count').textContent = state.learned.size;
    $('#progress-percent').textContent = `${percent}% of this lesson`; $('#progress-bar').style.width = `${percent}%`;
    $('#level-label').textContent = percent === 100 ? 'Keep practising' : percent ? 'In progress' : 'Getting started';
    $('#header-streak').textContent = BK.streak(state.days); $('#saved-count').textContent = state.saved.size;
    $('#storage-note').textContent = store.available ? 'Saved words and progress stay in this browser.' : 'Browser storage is unavailable. You can keep learning; progress lasts for this visit.';
  }
  function closeMenu() { $('#mobile-nav').hidden = true; $('#menu-button').setAttribute('aria-expanded', 'false'); }
  function routeTo(route, { historyMode = 'push', focus = true, query, collection } = {}) {
    const next = routes.includes(route) ? route : 'home'; state.route = next;
    setCollection(isCollection(collection) ? collection : state.collection);
    if (next === 'dictionary' && typeof query === 'string') {
      state.dictionaryCategory = 'All'; state.dictionaryPage = 1; state.savedOnly = false;
      $('#dictionary-search').value = query; $('#dictionary-sort').value = 'default'; state.dictionaryLanguage = 'all'; $('#dictionary-language').value = 'all';
    }
    $$('.view').forEach(view => { const active = view.dataset.view === next; view.hidden = !active; view.classList.toggle('active', active); });
    $$('[data-route]').forEach(link => {
      const active = link.dataset.route === next; link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const target = new URL(location.href); target.hash = next;
    if (state.collection === 'all') target.searchParams.delete('lang'); else target.searchParams.set('lang', state.collection);
    if (next !== 'dictionary') target.searchParams.delete('q');
    else if (typeof query === 'string') target.searchParams.set('q', query);
    if (historyMode === 'push' && target.href !== location.href) history.pushState(null, '', target.href);
    if (historyMode === 'replace') history.replaceState(null, '', target.href);
    closeMenu();
    if (next === 'dictionary') renderDictionary();
    if (next === 'phrases') renderPhrases();
    if (next === 'numbers') renderNumbers();
    if (next === 'learn') renderLesson();
    document.title = `${next === 'home' ? 'Learn Bahasa Tutong' : next === 'community' ? 'About & feedback' : next[0].toUpperCase() + next.slice(1)} — Bahasa Kitani`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) { const heading = $(`#view-${next} h1`); heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function routeFromLocation() {
    const hash = location.hash.slice(1); if (hash === 'main') return;
    const query = new URLSearchParams(location.search).get('q');
    const route = legacyRoutes[hash] || hash || (query !== null ? 'dictionary' : 'home');
    routeTo(route, { historyMode: 'none', focus: false, query: route === 'dictionary' && query !== null ? query : undefined, collection: new URLSearchParams(location.search).get('lang') || 'all' });
  }
  function initDaily() {
    const now = new Date(); const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    const pool = WORDS.filter(word => word.notation !== 'clarify'); dailyWord = pool[day % pool.length];
    $('#daily-title').textContent = dailyWord.tutong; $('#daily-ms').textContent = dailyWord.malay; $('#daily-en').textContent = dailyWord.english;
    $('#daily-category').textContent = dailyWord.cat; $('#daily-note').textContent = dailyWord.note;
    $('#daily-date').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(now); updateDailySave();
  }
  function updateDailySave() {
    const saved = state.saved.has(dailyWord.id); const button = $('#daily-save');
    button.classList.toggle('saved', saved); button.setAttribute('aria-pressed', String(saved));
    button.innerHTML = saved ? '<span aria-hidden="true">✓</span> Saved to your words' : '<span aria-hidden="true">＋</span> Save this word';
  }
  function toggleSaved(id) {
    if (!validIds.has(id)) return; const saved = state.saved.has(id);
    saved ? state.saved.delete(id) : state.saved.add(id); persist(); updateDailySave();
    if (state.route === 'dictionary') { renderDictionary(); ($(`[data-save="${id}"]`) || $('#saved-filter')).focus({ preventScroll: true }); }
    toast(saved ? 'Removed from saved words' : 'Word saved');
  }
  function initTopics() {
    const topics = [['Food & Drink', '◒', 'Food & drink'], ['People', '☺', 'People'], ['Home', '⌂', 'At home'], ['Nature', '✦', 'Nature']];
    $('#topic-grid').innerHTML = topics.map(([category, icon, label]) => `<button class="topic-card" type="button" data-category="${esc(category)}"><span class="topic-icon" aria-hidden="true">${icon}</span><strong>${label}</strong><small>${WORDS.filter(word => word.cat === category).length} words →</small></button>`).join('');
    $$('.topic-card').forEach(button => button.addEventListener('click', () => {
      setCollection('tutong'); state.dictionaryCategory = button.dataset.category; state.dictionaryPage = 1; state.savedOnly = false;
      $('#dictionary-search').value = ''; routeTo('dictionary', { collection: 'tutong' });
    }));
    const phrase = PHRASES[new Date().getDate() % PHRASES.length];
    $('#home-phrase-tutong').textContent = phrase.tutong; $('#home-phrase-english').textContent = phrase.english;
  }
  function newQuick() {
    const pool = WORDS.filter(word => word.notation !== 'clarify' && word.malay.trim() && word.english && word.english.length < 28 && !word.english.includes('/'));
    const word = pool[Math.floor(Math.random() * pool.length)]; $('#quick-word').textContent = word.tutong; $('#quick-feedback').textContent = '';
    $('#quick-options').innerHTML = BK.choicesFor(word, pool).map(choice => `<button type="button" data-id="${choice.id}"><span class="quick-answer" lang="ms"><small class="quick-language">BM</small><span>${esc(choice.malay)}</span></span><span class="quick-answer" lang="en"><small class="quick-language">EN</small><span>${esc(choice.english)}</span></span></button>`).join('');
    let answered = false;
    $$('#quick-options button').forEach(button => button.addEventListener('click', () => {
      if (answered) return; answered = true; const correct = Number(button.dataset.id) === word.id;
      $$('#quick-options button').forEach(option => { option.disabled = true; if (Number(option.dataset.id) === word.id) option.classList.add('correct'); });
      if (!correct) button.classList.add('wrong');
      const meaning = `${word.malay} (BM) / ${word.english} (EN)`;
      $('#quick-feedback').textContent = correct ? `Correct. ${meaning}.` : `The answer is ${meaning}.`;
      state.learned.add(word.id); persist(); markToday();
    }));
  }
  function revealCard() {
    state.revealed = !state.revealed;
    if (state.revealed) { state.learned.add(lessonWords[state.lessonIndex].id); persist(); }
    renderLesson();
  }
  function renderLesson() {
    const quiz = state.lessonMode !== 'cards'; $('#study-stage').hidden = quiz; $('#quiz-stage').hidden = !quiz;
    const word = lessonWords[state.lessonIndex];
    $('#flash-word').textContent = word.tutong; $('#flash-ms').textContent = word.malay; $('#flash-en').textContent = word.english;
    $('#flash-answer').hidden = !state.revealed; $('#flash-hint').textContent = state.revealed ? (word.note || word.cat) : 'Tap to reveal';
    $('#flashcard').setAttribute('aria-expanded', String(state.revealed));
    $('#flashcard').setAttribute('aria-label', `${state.revealed ? 'Hide' : 'Reveal'} translation of ${word.tutong}`);
    $('#lesson-prev').disabled = state.lessonIndex === 0;
    $('#lesson-next').textContent = state.lessonIndex === lessonWords.length - 1 ? 'Start quiz →' : 'Next →';
    $('#lesson-know').innerHTML = state.revealed ? 'Continue <span>→</span>' : 'Reveal translation <span>↻</span>';
    $('#lesson-word-list').innerHTML = lessonWords.map((item, index) => `<div class="lesson-word-item ${index === state.lessonIndex ? 'current' : ''} ${state.learned.has(item.id) ? 'known' : ''}"><span>${state.learned.has(item.id) ? '✓' : index + 1}</span>${esc(item.tutong)}</div>`).join('');
    if (!quiz) { $('#lesson-step-label').textContent = `Card ${state.lessonIndex + 1} of ${lessonWords.length}`; $('#lesson-meter-bar').style.width = `${(state.lessonIndex + 1) / lessonWords.length * 100}%`; }
  }
  function moveLesson(direction) {
    if (direction > 0) { state.learned.add(lessonWords[state.lessonIndex].id); persist(); }
    if (direction > 0 && state.lessonIndex === lessonWords.length - 1) { startQuiz(lessonWords); return; }
    state.lessonIndex = Math.max(0, Math.min(lessonWords.length - 1, state.lessonIndex + direction)); state.revealed = false; persist(); renderLesson();
  }
  function startQuiz(words) {
    state.lessonMode = 'quiz'; state.quizWords = BK.shuffle(words); state.quizIndex = 0; state.quizAnswers = [];
    renderLesson(); renderQuiz();
  }
  function renderQuiz() {
    const word = state.quizWords[state.quizIndex]; state.quizAnswered = false;
    $('#lesson-step-label').textContent = `Check ${state.quizIndex + 1} of ${state.quizWords.length}`;
    $('#lesson-meter-bar').style.width = `${(state.quizIndex + 1) / state.quizWords.length * 100}%`;
    $('#quiz-content').innerHTML = `<span class="section-kicker">Quick check · English meaning</span><h2 tabindex="-1" class="quiz-title">${esc(word.tutong)}</h2><p>Which meaning matches this Tutong word?</p><div class="quiz-choices">${BK.choicesFor(word, lessonWords).map(choice => `<button type="button" data-answer="${choice.id}">${esc(choice.english)}</button>`).join('')}</div><p class="quiz-feedback" role="status" id="quiz-feedback"></p><button id="quiz-next" class="primary-button" type="button" hidden>${state.quizIndex === state.quizWords.length - 1 ? 'See results' : 'Next question'} →</button>`;
    $$('[data-answer]').forEach(button => button.addEventListener('click', () => {
      if (state.quizAnswered) return; state.quizAnswered = true; const correct = Number(button.dataset.answer) === word.id;
      state.quizAnswers.push({ word, correct });
      $$('[data-answer]').forEach(choice => { choice.disabled = true; if (Number(choice.dataset.answer) === word.id) choice.classList.add('correct'); });
      if (!correct) button.classList.add('wrong');
      $('#quiz-feedback').textContent = correct ? 'Correct!' : `${word.tutong} means “${word.english}” (${word.malay}).`;
      $('#quiz-next').hidden = false; $('#quiz-next').focus(); state.learned.add(word.id); persist(); markToday();
    }));
    $('#quiz-next').addEventListener('click', () => { state.quizIndex++; state.quizIndex === state.quizWords.length ? finishQuiz() : renderQuiz(); });
    $('#quiz-content h2').focus({ preventScroll: true });
  }
  function finishQuiz() {
    state.lessonMode = 'result'; const missed = state.quizAnswers.filter(answer => !answer.correct).map(answer => answer.word); const score = state.quizAnswers.length - missed.length;
    $('#lesson-step-label').textContent = 'Lesson complete';
    $('#quiz-content').innerHTML = `<span class="section-kicker">Lesson complete</span><h2 class="quiz-title" tabindex="-1">${score} / ${state.quizWords.length}</h2><p>${missed.length ? 'A little review will help these words stick.' : 'You matched every word. Nicely done!'}</p>${missed.length ? `<ul class="review-list">${missed.map(word => `<li><strong>${esc(word.tutong)}</strong><span>${esc(word.english)}</span></li>`).join('')}</ul><button id="review-quiz" class="primary-button" type="button">Review missed words →</button>` : ''}<button id="restart-lesson" class="text-button" type="button">Practise the full lesson again</button><button id="finish-lesson" class="text-button" type="button">Back to home →</button>`;
    $('#review-quiz')?.addEventListener('click', () => startQuiz(missed));
    $('#restart-lesson').addEventListener('click', () => { state.lessonMode = 'cards'; state.lessonIndex = 0; state.revealed = false; persist(); renderLesson(); });
    $('#finish-lesson').addEventListener('click', () => routeTo('home')); markToday(); $('#quiz-content h2').focus({ preventScroll: true });
  }
  function initDictionary() {
    $('#hero-word-count').textContent = WORDS.length; $('#home-search-count').textContent = WORDS.length;
    $('#dictionary-categories').addEventListener('click', event => {
      const button = event.target.closest('[data-cat]'); if (!button) return;
      state.dictionaryCategory = button.dataset.cat; state.dictionaryPage = 1; renderDictionary();
    });
    $('#dictionary-search').addEventListener('input', () => { state.dictionaryPage = 1; renderDictionary(); });
    $('#dictionary-sort').addEventListener('change', () => { state.dictionaryPage = 1; renderDictionary(); });
    $('#dictionary-language').addEventListener('change', () => { state.dictionaryLanguage = $('#dictionary-language').value; state.dictionaryPage = 1; renderDictionary(); });
    $('#saved-filter').addEventListener('click', () => { state.savedOnly = !state.savedOnly; state.dictionaryPage = 1; if (state.savedOnly) { state.dictionaryCategory = 'All'; $('#dictionary-search').value = ''; } renderDictionary(); });
    $('#dictionary-more').addEventListener('click', () => { state.dictionaryPage++; renderDictionary(); });
  }
  function renderDictionary() {
    const pool = BKCollections.select(catalog.words, state.collection), categories = ['All', ...new Set(pool.map(word => word.cat))];
    if (!categories.includes(state.dictionaryCategory)) state.dictionaryCategory = 'All';
    const container = $('#dictionary-categories'), signature = JSON.stringify(categories);
    if (container.dataset.options !== signature) {
      container.innerHTML = categories.map(category => '<button type="button" data-cat="' + esc(category) + '">' + esc(category) + '</button>').join(''); container.dataset.options = signature;
    }
    $('#dictionary-total').textContent = pool.length;
    if (state.route === 'dictionary') {
      const target = new URL(location.href), query = $('#dictionary-search').value.trim();
      if (query) target.searchParams.set('q', query); else target.searchParams.delete('q');
      if (target.href !== location.href) history.replaceState(null, '', target.href);
    }
    const matches = BK.findWords(pool, { query: $('#dictionary-search').value, category: state.dictionaryCategory, savedOnly: state.savedOnly, saved: state.saved, sort: $('#dictionary-sort').value, language: state.dictionaryLanguage });
    const results = matches.results, visible = results.slice(0, state.dictionaryPage * 48);
    $$('#dictionary-categories button').forEach(button => { const active = button.dataset.cat === state.dictionaryCategory; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    $('#saved-filter').classList.toggle('active', state.savedOnly); $('#saved-filter').setAttribute('aria-pressed', String(state.savedOnly));
    $('#dictionary-result-label').textContent = (matches.approximate ? 'Closest spellings: ' : '') + 'Showing ' + visible.length + ' of ' + results.length + ' entries · ' + BKCollections.names[state.collection];
    $('#dictionary-match-note').hidden = !matches.approximate;
    $('#dictionary-match-note').textContent = matches.approximate ? 'No exact matches. These are nearby spellings; check the word and its translations.' : '';
    $('#dictionary-empty').hidden = results.length !== 0; $('#dictionary-more').hidden = visible.length >= results.length;
    const labels = { variant: 'Regional variant', loanword: 'Loanword', clarify: 'Needs clarification' };
    $('#dictionary-grid').innerHTML = visible.map(word => '<article class="word-card">' + languageLabel(word) + '<button class="save-word ' + (state.saved.has(word.id) ? 'saved' : '') + '" type="button" data-save="' + word.id + '" aria-pressed="' + state.saved.has(word.id) + '" aria-label="' + (state.saved.has(word.id) ? 'Remove ' : 'Save ') + esc(word.tutong) + '">' + (state.saved.has(word.id) ? '♥' : '♡') + '</button><h3>' + esc(word.tutong) + '</h3><dl><div><dt>BM</dt><dd>' + esc(word.malay) + '</dd></div><div><dt>EN</dt><dd>' + esc(word.english) + '</dd></div></dl><div class="word-foot"><span>' + esc(word.cat) + '</span>' + (word.notation ? '<span class="note">' + esc(labels[word.notation] || word.notation) + '</span>' : '') + '</div>' + (word.language !== 'tutong' ? statusLabel(word) : '') + entryDetails(word) + '</article>').join('');
    $$('[data-save]').forEach(button => button.addEventListener('click', () => toggleSaved(Number(button.dataset.save)))); updateProgress();
  }
  function initPhrases() {
    $('#phrase-filters').addEventListener('click', event => {
      const button = event.target.closest('[data-phrase-cat]'); if (!button) return;
      state.phraseCategory = button.dataset.phraseCat; renderPhrases();
    });
  }
  function renderPhrases() {
    const pool = BKCollections.select(catalog.phrases, state.collection), categories = ['All', ...new Set(pool.map(phrase => phrase.cat))];
    if (!categories.includes(state.phraseCategory)) state.phraseCategory = 'All';
    const container = $('#phrase-filters'), signature = JSON.stringify(categories);
    if (container.dataset.options !== signature) {
      container.innerHTML = categories.map(category => '<button type="button" data-phrase-cat="' + esc(category) + '">' + esc(category) + '</button>').join(''); container.dataset.options = signature;
    }
    const results = pool.filter(phrase => state.phraseCategory === 'All' || phrase.cat === state.phraseCategory);
    $('#phrase-total').textContent = pool.length; $('#phrase-empty').hidden = results.length !== 0;
    $('#phrase-result-label').textContent = results.length + ' phrases and expressions · ' + BKCollections.names[state.collection];
    $$('#phrase-filters button').forEach(button => { const active = button.dataset.phraseCat === state.phraseCategory; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    $('#phrase-grid').innerHTML = results.map((phrase, index) => '<article class="phrase-card">' + languageLabel(phrase) + '<span class="phrase-cat">' + esc(phrase.cat) + '</span><h3>' + esc(phrase.tutong) + '</h3><dl><div><dt>Standard Malay</dt><dd>' + esc(phrase.malay) + '</dd></div><div><dt>English</dt><dd>' + esc(phrase.english) + '</dd></div></dl>' + (phrase.language !== 'tutong' ? statusLabel(phrase) : '') + entryDetails(phrase) + '<button type="button" data-copy-phrase="' + index + '" aria-label="Copy phrase ' + esc(phrase.tutong) + '">Copy phrase</button></article>').join('');
    $$('[data-copy-phrase]').forEach(button => button.addEventListener('click', async () => {
      const phrase = results[Number(button.dataset.copyPhrase)];
      try { await navigator.clipboard.writeText(phrase.tutong); toast('Phrase copied'); } catch { toast('Copy is unavailable. Select the phrase text to copy it.'); }
    }));
  }
  function renderNumbers() {
    $('#numbers-toggle').setAttribute('aria-pressed', String(state.numbersHidden)); $('#numbers-toggle').textContent = state.numbersHidden ? 'Show all number words' : 'Hide number words';
    const groups = Object.entries(catalog.numbers).filter(([language, records]) => records.length && (state.collection === 'all' || state.collection === language));
    $('#numbers-empty').hidden = groups.length !== 0; $('#numbers-toggle').disabled = !groups.length;
    $('#number-grid').innerHTML = groups.map(([language, records]) => '<section class="number-collection" aria-label="' + esc(BKCollections.names[language]) + ' numbers"><h2>' + esc(BKCollections.names[language]) + '<small>' + records.length + ' recorded numbers</small></h2>' + (language === 'dusun' ? '<p class="local-note">Siam and Walu’ for nine were confirmed by the maintainer. Walu for eight remains unverified. Other recorded forms may vary by speaker or region.</p>' : '') + '<div class="number-grid">' + records.map(entry => '<article class="number-entry"><button class="number-tile" type="button" data-number="' + entry.number + '" data-number-language="' + language + '" aria-expanded="' + !state.numbersHidden + '" aria-label="' + entry.number + ', ' + esc(BKCollections.names[language]) + (state.numbersHidden ? ', reveal word' : ', ' + esc(entry.word)) + '"><strong>' + entry.number + '</strong><span ' + (state.numbersHidden ? 'hidden' : '') + '>' + esc(entry.word) + '</span><small ' + (state.numbersHidden ? '' : 'hidden') + '>Tap to reveal</small></button><div class="number-details" ' + (state.numbersHidden ? 'hidden' : '') + '>' + (language !== 'tutong' ? statusLabel(entry) : '') + entryDetails({ note: entry.note, sourceFile: [...new Set(entry.records.map(record => record.sourceFile).filter(Boolean))].join(' · '), sourceUrl: entry.records.find(record => record.sourceUrl)?.sourceUrl, additionalSources: [...new Map(entry.records.filter(record => record.sourceUrl).map(record => [record.sourceUrl, { url: record.sourceUrl, name: record.sourceFile || 'Source' }])).values()].slice(1) }) + '</div></article>').join('') + '</div></section>').join('');
    $$('[data-number]').forEach(button => button.addEventListener('click', () => {
      if (!state.numbersHidden) return;
      const language = button.dataset.numberLanguage, entry = catalog.numbers[language].find(record => record.number === Number(button.dataset.number)), expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded)); button.setAttribute('aria-label', button.dataset.number + ', ' + BKCollections.names[language] + ', ' + (expanded ? 'reveal word' : entry.word));
      button.querySelector('span').hidden = expanded; button.querySelector('small').hidden = !expanded; button.parentElement.querySelector('.number-details').hidden = expanded;
    }));
  }
  function bindEvents() {
    $$('[data-route]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); routeTo(button.dataset.route, { collection: button.dataset.collection, query: button.dataset.collection && button.dataset.route === 'dictionary' ? '' : undefined }); }));
    $('#home-search-form').addEventListener('submit', event => {
      event.preventDefault(); const input = $('#home-search-input'); const query = input.value.trim();
      if (!query) { input.value = ''; input.reportValidity(); return; }
      routeTo('dictionary', { query, collection: 'tutong' });
    });
    $('#menu-button').addEventListener('click', () => { const open = $('#menu-button').getAttribute('aria-expanded') === 'true'; $('#menu-button').setAttribute('aria-expanded', String(!open)); $('#mobile-nav').hidden = open; });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('#mobile-nav').hidden) { closeMenu(); $('#menu-button').focus(); }
      if (event.key === '/' && state.route === 'dictionary' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); $('#dictionary-search').focus(); }
    });
    window.addEventListener('popstate', routeFromLocation); window.addEventListener('hashchange', routeFromLocation);
    $('#theme-toggle').addEventListener('click', () => {
      const night = document.documentElement.dataset.theme === 'night'; document.documentElement.dataset.theme = night ? '' : 'night'; store.write('bk-theme', night ? 'day' : 'night'); updateProgress();
      $('#theme-toggle').setAttribute('aria-label', night ? 'Switch to dark theme' : 'Switch to light theme');
    });
    $('#daily-save').addEventListener('click', () => toggleSaved(dailyWord.id)); $('#next-quick').addEventListener('click', newQuick);
    $('#flashcard').addEventListener('click', revealCard); $('#lesson-prev').addEventListener('click', () => moveLesson(-1)); $('#lesson-next').addEventListener('click', () => moveLesson(1));
    $('#lesson-know').addEventListener('click', () => state.revealed ? moveLesson(1) : revealCard());
    for (const [name, route] of [['dictionary', 'dictionary'], ['phrase', 'phrases'], ['numbers', 'numbers']]) {
      $('#' + name + '-collection').addEventListener('change', event => routeTo(route, { collection: event.target.value, historyMode: 'replace', focus: false }));
    }
    $('#numbers-toggle').addEventListener('click', () => { state.numbersHidden = !state.numbersHidden; renderNumbers(); });
    $('#feedback-form').addEventListener('submit', event => {
      event.preventDefault(); const message = $('#feedback-message').value.trim(); if (!message) { $('#feedback-message').focus(); return; }
      const subject = `[Bahasa Kitani] ${$('#feedback-type').value}`;
      location.href = `mailto:sam@bahasa-kitani.xyz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      $('#feedback-status').textContent = 'Email draft requested. Review and send it in your email app, or email sam@bahasa-kitani.xyz directly. Your note stays here.';
    });
  }
  function boot() {
    if (store.read('bk-theme', 'day', value => ['day', 'night'].includes(value)) === 'night') document.documentElement.dataset.theme = 'night';
    bindEvents(); initDaily(); initTopics(); initDictionary(); initPhrases(); renderNumbers(); newQuick(); updateProgress();
    const query = new URLSearchParams(location.search).get('q');
    if (query !== null) routeTo('dictionary', { historyMode: 'replace', focus: false, query, collection: new URLSearchParams(location.search).get('lang') || 'all' }); else routeFromLocation();
    if (typeof BKUI !== 'undefined') BKUI.init({
      words: catalog.words, searchWords: WORDS, lessonSize: lessonWords.length, openSearch: query => routeTo('dictionary', { query, collection: 'tutong' }),
      getProgress: () => ({ saved: [...state.saved], learned: [...state.learned], days: [...state.days], lessonIndex: state.lessonIndex, theme: document.documentElement.dataset.theme === 'night' ? 'night' : 'day' }),
      applyProgress: data => {
        state.saved = new Set(data.saved); state.learned = new Set(data.learned); state.days = data.days; state.lessonIndex = data.lessonIndex;
        state.revealed = false; state.lessonMode = 'cards';
        const writes = [store.write('bk-saved', data.saved), store.write('bk-learned', data.learned), store.write('bk-days', data.days), store.write('bk-lesson-index', data.lessonIndex), store.write('bk-theme', data.theme)];
        document.documentElement.dataset.theme = data.theme === 'night' ? 'night' : '';
        $('#theme-toggle').setAttribute('aria-label', data.theme === 'night' ? 'Switch to light theme' : 'Switch to dark theme');
        updateProgress(); updateDailySave(); if (state.route === 'dictionary') renderDictionary(); if (state.route === 'learn') renderLesson();
        return writes.every(Boolean);
      }
    });
    $('#copyright-year').textContent = new Date().getFullYear();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
  boot();
})();
