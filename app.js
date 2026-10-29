(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  if (typeof WORDS === 'undefined' || !Array.isArray(WORDS) || !WORDS.length || typeof BK === 'undefined' || typeof BKCollections === 'undefined') {
    $('#app-error').hidden = false; return;
  }
  const store = BK.storage(() => window.localStorage), names = BKCollections.names;
  const isCollection = value => Object.hasOwn(names, value);
  const idList = value => Array.isArray(value) && value.every(id => Number.isSafeInteger(id) && id > 0);
  const daysList = value => Array.isArray(value) && value.every(key => typeof key === 'string' && BK.dateForKey(key));
  const lessonWords = [735, 733, 306, 159, 49, 117, 149, 150].map(id => WORDS.find(word => word.id === id)).filter(Boolean);
  let extra = { brunei: [], dusun: [], failed: [], loaded: [] }, catalog = BKCollections.build({words: WORDS, phrases: PHRASES, numbers: NUMBERS});
  let catalogReady, catalogRevision = 0, ui;
  const validIds = new Set(catalog.words.map(word => word.id));
  const state = {
    route: 'home', collection: store.read('bk-collection', 'all', isCollection), dictionaryCategory: 'All', dictionaryPage: 1, savedOnly: false, dictionaryLanguage: 'all',
    saved: new Set(store.read('bk-saved', [], idList)), learned: new Set(store.read('bk-learned', [], idList)), mistakes: new Set(store.read('bk-mistakes', [], idList)),
    days: store.read('bk-days', [], daysList), lists: [], wordsList: 'all', wordsPage: 1,
    lessonIndex: store.read('bk-lesson-index', 0, value => Number.isInteger(value) && value >= 0 && value < lessonWords.length),
    revealed: false, phraseCategory: 'All', numbersHidden: false, numberQuiz: null,
    lessonMode: 'cards', quizWords: [], quizIndex: 0, quizAnswers: [], quizAnswered: false,
    practiceWords: [], practiceIndex: 0, practiceAnswers: [], practiceAnswered: false
  };
  const getProgress = () => ({ saved: [...state.saved], learned: [...state.learned], mistakes: [...state.mistakes], lists: state.lists, days: state.days, lessonIndex: state.lessonIndex, theme: document.documentElement.dataset.theme === 'night' ? 'night' : 'day' });
  try { state.lists = BK.parseProgressBackup(JSON.stringify({app:'bahasa-kitani', version:1, data:{...getProgress(), lists:store.read('bk-lists', [], Array.isArray)}}), lessonWords.length).data.lists; } catch { state.lists = []; }
  const routes = ['home', 'learn', 'lesson', 'dictionary', 'phrases', 'numbers', 'words', 'practice', 'community'];
  const learningRoutes = ['learn', 'lesson', 'phrases', 'numbers'];
  const legacyRoutes = { 'numbers-sec': 'numbers', previews: 'dictionary', 'dict-preview': 'dictionary', 'body-preview': 'dictionary', 'animals-preview': 'dictionary', 'food-preview': 'dictionary', phrasebook: 'phrases', feedback: 'community', saved:'words', languages:'dictionary' };
  let dailyWord;
  function persist() {
    const writes = [store.write('bk-saved', [...state.saved]), store.write('bk-learned', [...state.learned]), store.write('bk-mistakes', [...state.mistakes]), store.write('bk-lists', state.lists), store.write('bk-lesson-index', state.lessonIndex)];
    updateProgress(); return writes.every(Boolean);
  }
  function toast(message) {
    const element = $('#toast'); element.textContent = message; element.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }
  function markToday() {
    state.days = [...new Set([...state.days, BK.dayKey()])].sort().slice(-370);
    store.write('bk-days', state.days); updateProgress();
  }
  function recordAnswer(word, correct) {
    correct ? state.mistakes.delete(word.id) : state.mistakes.add(word.id);
    state.learned.add(word.id); persist(); markToday();
  }
  function updateProgress() {
    const done = lessonWords.filter(word => state.learned.has(word.id)).length, percent = Math.round(done / lessonWords.length * 100) || 0;
    $('#learned-count').textContent = state.learned.size; $('#learned-description').textContent = state.learned.size === 1 ? 'word practised' : 'words practised';
    $('#progress-percent').textContent = `${percent}% of this lesson`; $('#progress-bar').style.width = `${percent}%`;
    $('#level-label').textContent = percent === 100 ? 'Keep practising' : percent ? 'In progress' : 'Getting started';
    $('#header-streak').textContent = BK.streak(state.days); $('#saved-count').textContent = state.saved.size;
    $('#mistake-count').textContent = catalog.words.filter(word => state.mistakes.has(word.id) && (state.collection === 'all' || word.language === state.collection)).length;
    $('#storage-note').textContent = store.available ? 'Saved on this browser. Download a backup to keep your learning on another device.' : 'Browser storage is unavailable. Download a backup to keep this visit’s progress.';
  }
  function setCollection(collection) {
    if (!isCollection(collection)) return;
    if (collection !== state.collection) { state.dictionaryCategory = 'All'; state.dictionaryPage = 1; state.phraseCategory = 'All'; state.wordsPage = 1; state.numberQuiz = null; }
    state.collection = collection; store.write('bk-collection', collection);
    for (const name of ['home', 'dictionary', 'phrase', 'numbers', 'words']) $('#' + name + '-collection').value = collection;
    $('#home-search-count').textContent = BKCollections.select(catalog.words, collection).length;
  }
  function closeMenu() { $('#mobile-nav').hidden = true; $('#menu-button').setAttribute('aria-expanded', 'false'); }
  function routeTo(route, { historyMode = 'push', focus = true, query, collection } = {}) {
    const next = routes.includes(route) ? route : 'home'; state.route = next;
    setCollection(isCollection(collection) ? collection : state.collection);
    if (next === 'dictionary' && typeof query === 'string') {
      resetFilters(); $('#dictionary-search').value = query;
    }
    if (next === 'phrases' && typeof query === 'string') { state.phraseCategory = 'All'; $('#phrase-search').value = query; }
    $$('.view').forEach(view => { const active = view.dataset.view === next; view.hidden = !active; view.classList.toggle('active', active); });
    $$('[data-route]').forEach(link => {
      const isPrimary = link.closest('[aria-label="Main navigation"], #mobile-nav');
      const active = link.dataset.route === next || (isPrimary && link.dataset.route === 'learn' && learningRoutes.includes(next)) || (isPrimary && link.dataset.route === 'words' && next === 'practice');
      link.classList.toggle('active', Boolean(active));
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const target = new URL(location.href); target.hash = next;
    if (state.collection === 'all') target.searchParams.delete('lang'); else target.searchParams.set('lang', state.collection);
    const search = next === 'dictionary' ? $('#dictionary-search').value.trim() : next === 'phrases' ? $('#phrase-search').value.trim() : '';
    if (search) target.searchParams.set('q', search); else target.searchParams.delete('q');
    if (historyMode === 'push' && target.href !== location.href) history.pushState(null, '', target.href);
    if (historyMode === 'replace') history.replaceState(null, '', target.href);
    closeMenu(); renderActive();
    const titles = {home:'Brunei’s Living Languages', learn:'Learn', lesson:'Everyday essentials', dictionary:'Dictionary', phrases:'Phrasebook', numbers:'Numbers & counting', words:'My Words', practice:'Practise My Words', community:'About & feedback'};
    document.title = `${titles[next]} — Bahasa Kitani`;
    window.scrollTo({top:0, behavior:'instant'});
    if (focus) { const heading = $(`#view-${next} h1`); heading.tabIndex = -1; heading.focus({preventScroll:true}); }
  }
  function routeFromLocation() {
    const hash = location.hash.slice(1); if (hash === 'main') return;
    const params = new URLSearchParams(location.search), query = params.get('q');
    const route = legacyRoutes[hash] || hash || (query !== null ? 'dictionary' : 'home');
    routeTo(route, {historyMode:'none', focus:false, query:['dictionary','phrases'].includes(route) ? query || '' : undefined, collection:params.get('lang') || (location.hash ? 'all' : state.collection)});
  }
  function renderActive() {
    if (state.route === 'dictionary') renderDictionary();
    if (state.route === 'phrases') renderPhrases();
    if (state.route === 'numbers') renderNumbers();
    if (state.route === 'lesson') renderLesson();
    if (state.route === 'words') renderWords();
    if (state.route === 'practice') renderPractice();
  }
  function entryDetails(word) {
    const source = word.sourceFile || '', links = [];
    if (word.sourceUrl && /^https:\/\//.test(word.sourceUrl)) links.push('<a href="' + esc(word.sourceUrl) + '" target="_blank" rel="noopener noreferrer">Read original source ↗</a>');
    for (const item of word.additionalSources || []) if (/^https:\/\//.test(item.url || '')) links.push('<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.name || 'Additional source') + ' ↗</a>');
    const original = word.sourceCategory && word.sourceCategory !== word.cat ? '<p>Source category: ' + esc(word.sourceCategory) + '</p>' : '';
    const variants = word.variants?.length ? '<p>Recorded spellings: ' + esc(word.variants.join(' / ')) + '</p>' : '';
    const location = [word.journalPage ? 'journal p. ' + word.journalPage : '', word.pdfPage ? 'PDF p. ' + word.pdfPage : '', word.sourceTable || '', word.sourceLine ? 'source line ' + word.sourceLine : ''].filter(Boolean).join(' · ');
    if (!word.note && !source && !links.length && !original && !variants) return '';
    return '<details class="entry-note"><summary>' + (source ? 'Notes & sources' : 'Entry note') + '</summary>' + (word.note ? '<p>' + esc(word.note) + '</p>' : '') + original + variants + (source ? '<p>Source: ' + esc(source) + (location ? ' · ' + esc(location) : '') + '</p>' : '') + links.map(link => '<p>' + link + '</p>').join('') + '</details>';
  }
  function languageLabel(word) { return '<span class="collection-label ' + word.language + '">' + esc(names[word.language]) + '</span>'; }
  function statusLabel(word) { return '<span class="review-label ' + esc(word.status) + '">' + esc(BKCollections.statusLabel(word.status)) + '</span>'; }
  function entryContext(word) {
    const examples = (word.examples || []).filter(item => item.status === 'reviewed' && item.text && (item.malay || item.english || item.explanation));
    let content = examples.map(item => '<div class="example-sentence"><strong>' + esc(item.text) + '</strong><span>' + esc([item.malay, item.english, item.explanation].filter(Boolean).join(' · ')) + '</span><small>Community checked' + (item.credit ? ' · ' + esc(item.credit) : '') + '</small></div>').join('');
    const audio = word.audio;
    const hasAudio = audio?.status === 'reviewed' && audio.speaker && /^(https:\/\/|assets\/audio\/[a-zA-Z0-9_/-]+\.(mp3|ogg|wav)$)/.test(audio.url || '');
    if (hasAudio) content += '<div class="entry-audio"><audio controls preload="none" src="' + esc(audio.url) + '" aria-label="Pronunciation of ' + esc(word.tutong) + '"></audio><small>Speaker: ' + esc(audio.speaker) + '</small></div>';
    const forms = BK.aliases(word.tutong).filter(value => value.length >= 2);
    const contexts = catalog.phrases.filter(phrase => phrase.language === word.language && forms.some(value => BK.normalize(phrase.tutong) !== value && (' ' + BK.normalize(phrase.tutong).replace(/[.,!?]/g,'') + ' ').includes(' ' + value + ' '))).slice(0,2);
    if (contexts.length) content += '<div class="phrase-context"><small>From the phrasebook</small>' + contexts.map(phrase => '<button class="text-button" type="button" data-route="phrases" data-collection="' + word.language + '" data-query="' + esc(phrase.tutong) + '">' + esc(phrase.tutong) + ' →</button>').join('') + '</div>';
    return content ? '<details class="word-context"><summary>' + (hasAudio ? 'Context & pronunciation' : 'Use in context') + '</summary>' + content + '</details>' : '';
  }
  function wordCard(word, lists = false) {
    const saved = state.saved.has(word.id), labels = {variant:'Regional variant', loanword:'Loanword', clarify:'Needs clarification'};
    const listControls = lists && state.lists.length && saved ? '<details class="word-lists"><summary>Study lists</summary>' + state.lists.map(list => '<label><input type="checkbox" data-list-word="' + word.id + '" data-study-list="' + esc(list.id) + '" ' + (list.words.includes(word.id) ? 'checked' : '') + '>' + esc(list.name) + '</label>').join('') + '</details>' : '';
    return '<article class="word-card" data-word-id="' + word.id + '">' + languageLabel(word) + '<button class="save-word ' + (saved ? 'saved' : '') + '" type="button" data-save="' + word.id + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Remove ' : 'Save ') + esc(word.tutong) + '">' + (saved ? '♥' : '♡') + '</button><h3>' + esc(word.tutong) + '</h3><dl><div><dt>BM</dt><dd>' + esc(word.malay) + '</dd></div><div><dt>EN</dt><dd>' + esc(word.english) + '</dd></div></dl><div class="word-foot"><span>' + esc(word.cat) + '</span>' + (word.notation ? '<span class="note">' + esc(labels[word.notation] || word.notation) + '</span>' : '') + '</div>' + (word.language !== 'tutong' ? statusLabel(word) : '') + entryContext(word) + entryDetails(word) + listControls + '</article>';
  }
  const cardCaches = new WeakMap();
  function renderWordGrid(container, words, withLists = false) {
    let cache = cardCaches.get(container); if (!cache) { cache = new Map(); cardCaches.set(container, cache); }
    const listSignature = withLists ? JSON.stringify(state.lists) : '', nodes = [];
    for (const word of words) {
      const signature = [catalogRevision, state.saved.has(word.id), listSignature].join('|');
      let card = cache.get(word.id);
      if (!card || card.signature !== signature) {
        const holder = document.createElement('div'); holder.innerHTML = wordCard(word, withLists);
        card = {signature, node:holder.firstElementChild}; cache.set(word.id, card);
      }
      nodes.push(card.node);
    }
    const current = [...container.children];
    if (current.length !== nodes.length || nodes.some((node, index) => current[index] !== node)) container.replaceChildren(...nodes);
    for (const id of cache.keys()) if (!words.some(word => word.id === id)) cache.delete(id);
  }
  function toggleSaved(id) {
    if (!validIds.has(id)) return; const saved = state.saved.has(id);
    if (saved) { state.saved.delete(id); state.lists.forEach(list => list.words = list.words.filter(value => value !== id)); } else state.saved.add(id);
    persist(); updateDailySave();
    if (['dictionary', 'words'].includes(state.route)) { renderActive(); ($(`[data-view="${state.route}"] [data-save="${id}"]`) || (state.route === 'words' ? $('#words-list') : $('#saved-filter'))).focus({preventScroll:true}); }
    toast(saved ? 'Removed from saved words' : 'Word saved to My Words');
  }
  function initTopics() {
    const topics = [['Food & Drink','◒','Food & drink'],['People','☺','People'],['Home','⌂','At home'],['Nature','✦','Nature']];
    $('#topic-grid').innerHTML = topics.map(([category, icon, label]) => '<button class="topic-card" type="button" data-category="' + esc(category) + '"><span class="topic-icon" aria-hidden="true">' + icon + '</span><strong>' + label + '</strong><small>' + catalog.words.filter(word => word.cat === category).length + ' words →</small></button>').join('');
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
      recordAnswer(word, correct);
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
    $('#quiz-content').innerHTML = `<span class="section-kicker">Quick check · Malay &amp; English</span><h2 tabindex="-1" class="quiz-title">${esc(word.tutong)}</h2><p>Which meaning matches this Tutong word?</p><div class="quiz-choices">${BK.choicesFor(word, lessonWords).map(choice => `<button type="button" data-answer="${choice.id}"><span lang="ms">${esc(choice.malay)}</span><small lang="en">${esc(choice.english)}</small></button>`).join('')}</div><p class="quiz-feedback" role="status" id="quiz-feedback"></p><button id="quiz-next" class="primary-button" type="button" hidden>${state.quizIndex === state.quizWords.length - 1 ? 'See results' : 'Next question'} →</button>`;
    $$('[data-answer]').forEach(button => button.addEventListener('click', () => {
      if (state.quizAnswered) return; state.quizAnswered = true; const correct = Number(button.dataset.answer) === word.id;
      state.quizAnswers.push({ word, correct });
      $$('[data-answer]').forEach(choice => { choice.disabled = true; if (Number(choice.dataset.answer) === word.id) choice.classList.add('correct'); });
      if (!correct) button.classList.add('wrong');
      $('#quiz-feedback').textContent = correct ? 'Correct!' : `${word.tutong} means “${word.english}” (${word.malay}).`;
      $('#quiz-next').hidden = false; $('#quiz-next').focus(); recordAnswer(word, correct);
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
  function resetFilters() {
    state.dictionaryCategory = 'All'; state.dictionaryPage = 1; state.savedOnly = false; state.dictionaryLanguage = 'all';
    $('#dictionary-category').value = 'All'; $('#dictionary-language').value = 'all'; $('#dictionary-sort').value = 'default'; $('#dictionary-review').value = 'all';
  }
  function initDictionary() {
    $('#hero-word-count').textContent = WORDS.length;
    $('#dictionary-category').addEventListener('change', event => { state.dictionaryCategory = event.target.value; state.dictionaryPage = 1; renderDictionary(); });
    let pendingSearch;
    $('#dictionary-search').addEventListener('input', () => { clearTimeout(pendingSearch); pendingSearch = setTimeout(() => {state.dictionaryPage = 1; renderDictionary();}, 90); });
    $('#dictionary-sort').addEventListener('change', () => { state.dictionaryPage = 1; renderDictionary(); });
    $('#dictionary-review').addEventListener('change', () => { state.dictionaryPage = 1; renderDictionary(); });
    $('#dictionary-language').addEventListener('change', () => { state.dictionaryLanguage = $('#dictionary-language').value; state.dictionaryPage = 1; renderDictionary(); });
    $('#saved-filter').addEventListener('click', () => { state.savedOnly = !state.savedOnly; state.dictionaryPage = 1; renderDictionary(); });
    $('#dictionary-more').addEventListener('click', () => { state.dictionaryPage++; renderDictionary(); });
    $('#active-filters').addEventListener('click', event => {
      const filter = event.target.closest('[data-clear-filter]')?.dataset.clearFilter;
      if (!filter) return;
      if (filter === 'all') resetFilters();
      if (filter === 'category') state.dictionaryCategory = 'All';
      if (filter === 'saved') state.savedOnly = false;
      if (filter === 'field') {state.dictionaryLanguage = 'all'; $('#dictionary-language').value = 'all';}
      if (filter === 'sort') $('#dictionary-sort').value = 'default';
      if (filter === 'review') $('#dictionary-review').value = 'all';
      state.dictionaryPage = 1; renderDictionary(); $('#dictionary-filters summary').focus();
    });
  }
  function renderDictionary() {
    const pool = BKCollections.select(catalog.words, state.collection), categories = ['All', ...new Set(pool.map(word => word.cat).sort())];
    if (!categories.includes(state.dictionaryCategory)) state.dictionaryCategory = 'All';
    const category = $('#dictionary-category'), signature = JSON.stringify(categories);
    if (category.dataset.options !== signature) { category.innerHTML = categories.map(value => '<option value="' + esc(value) + '">' + esc(value === 'All' ? 'All topics' : value) + '</option>').join(''); category.dataset.options = signature; }
    category.value = state.dictionaryCategory; $('#dictionary-total').textContent = pool.length;
    const query = $('#dictionary-search').value.trim(), sort = $('#dictionary-sort').value, review = $('#dictionary-review').value;
    if (state.route === 'dictionary') {
      const target = new URL(location.href); if (query) target.searchParams.set('q', query); else target.searchParams.delete('q');
      if (target.href !== location.href) history.replaceState(null, '', target.href);
    }
    const matches = BK.findWords(catalog.words, { query, collection:state.collection, category:state.dictionaryCategory, savedOnly:state.savedOnly, saved:state.saved, sort, language:state.dictionaryLanguage, review });
    const results = matches.results, visible = results.slice(0, state.dictionaryPage * 36), filters = [];
    if (state.dictionaryCategory !== 'All') filters.push(['category', state.dictionaryCategory]);
    if (state.savedOnly) filters.push(['saved', 'Saved only']);
    if (state.dictionaryLanguage !== 'all') filters.push(['field', $('#dictionary-language').selectedOptions[0].textContent]);
    if (sort !== 'default') filters.push(['sort', $('#dictionary-sort').selectedOptions[0].textContent]);
    if (review !== 'all') filters.push(['review', $('#dictionary-review').selectedOptions[0].textContent]);
    $('#filter-count').hidden = !filters.length; $('#filter-count').textContent = filters.length;
    $('#active-filters').hidden = !filters.length;
    $('#active-filters').innerHTML = filters.map(([key,label]) => '<button type="button" data-clear-filter="' + key + '" aria-label="Remove filter: ' + esc(label) + '">' + esc(label) + ' ×</button>').join('') + (filters.length ? '<button class="clear-all" type="button" data-clear-filter="all">Clear filters</button>' : '');
    $('#saved-filter').classList.toggle('active', state.savedOnly); $('#saved-filter').setAttribute('aria-pressed', String(state.savedOnly));
    $('#dictionary-result-label').textContent = (matches.approximate ? 'Closest spellings · ' : '') + visible.length + ' of ' + results.length + ' entries · ' + names[state.collection];
    $('#dictionary-match-note').hidden = !matches.approximate;
    $('#dictionary-match-note').textContent = matches.approximate ? 'No exact matches. Check these nearby spellings and their meanings.' : '';
    const waiting = state.collection !== 'all' && state.collection !== 'tutong' && !extra.loaded.includes(state.collection);
    $('#dictionary-empty').hidden = results.length !== 0; $('#dictionary-empty strong').textContent = waiting ? 'Loading this collection…' : 'No matching words';
    $('#dictionary-empty p').textContent = waiting ? 'You can keep browsing while the words load.' : 'Try another spelling, change the language or clear a filter.';
    $('#dictionary-more').hidden = visible.length >= results.length;
    renderWordGrid($('#dictionary-grid'), visible); updateProgress();
  }
  function initPhrases() {
    $('#phrase-filters').addEventListener('click', event => { const button = event.target.closest('[data-phrase-cat]'); if (!button) return; state.phraseCategory = button.dataset.phraseCat; renderPhrases(); });
    $('#phrase-search').addEventListener('input', renderPhrases);
  }
  function renderPhrases() {
    const pool = BKCollections.select(catalog.phrases, state.collection), categories = ['All', ...new Set(pool.map(phrase => phrase.cat))];
    if (!categories.includes(state.phraseCategory)) state.phraseCategory = 'All';
    const container = $('#phrase-filters'), signature = JSON.stringify(categories);
    if (container.dataset.options !== signature) { container.innerHTML = categories.map(category => '<button type="button" data-phrase-cat="' + esc(category) + '">' + esc(category) + '</button>').join(''); container.dataset.options = signature; }
    const query = $('#phrase-search').value.trim(), results = BK.findWords(catalog.phrases, {collection:state.collection, category:state.phraseCategory, query, fuzzy:false}).results;
    if (state.route === 'phrases') { const target = new URL(location.href); if (query) target.searchParams.set('q',query); else target.searchParams.delete('q'); if (target.href !== location.href) history.replaceState(null,'',target.href); }
    $('#phrase-total').textContent = pool.length; $('#phrase-empty').hidden = results.length !== 0;
    $('#phrase-result-label').textContent = results.length + (results.length === 1 ? ' phrase or expression · ' : ' phrases and expressions · ') + names[state.collection];
    $$('#phrase-filters button').forEach(button => { const active = button.dataset.phraseCat === state.phraseCategory; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    $('#phrase-grid').innerHTML = results.map((phrase, index) => '<article class="phrase-card">' + languageLabel(phrase) + '<span class="phrase-cat">' + esc(phrase.cat) + '</span><h3>' + esc(phrase.tutong) + '</h3><dl><div><dt>Standard Malay</dt><dd>' + esc(phrase.malay) + '</dd></div><div><dt>English</dt><dd>' + esc(phrase.english) + '</dd></div></dl>' + (phrase.language !== 'tutong' ? statusLabel(phrase) : '') + entryDetails(phrase) + '<button type="button" data-copy-phrase="' + index + '" aria-label="Copy phrase ' + esc(phrase.tutong) + '">Copy phrase</button></article>').join('');
    $$('[data-copy-phrase]').forEach(button => button.addEventListener('click', async () => { const phrase = results[Number(button.dataset.copyPhrase)]; try { await navigator.clipboard.writeText(phrase.tutong); toast('Phrase copied'); } catch { toast('Copy is unavailable. Select the phrase text to copy it.'); } }));
  }
  const numberText = number => new Intl.NumberFormat('en-GB').format(number);
  function numberTile(entry) {
    const language = entry.language, hidden = state.numbersHidden;
    const sourceRecords = entry.records || [], sources = [...new Map(sourceRecords.filter(record => record.sourceUrl).map(record => [record.sourceUrl,{url:record.sourceUrl,name:record.sourceFile || 'Source'}])).values()];
    return '<article class="number-entry"><button class="number-tile" type="button" data-number="' + entry.number + '" data-number-language="' + language + '" aria-expanded="' + !hidden + '" aria-label="' + numberText(entry.number) + ', ' + esc(names[language]) + (hidden ? ', reveal word' : ', ' + esc(entry.word)) + '"><strong>' + numberText(entry.number) + '</strong><span ' + (hidden ? 'hidden' : '') + '>' + esc(entry.word) + '</span><small ' + (hidden ? '' : 'hidden') + '>Tap to reveal</small></button><div class="number-details" ' + (hidden ? 'hidden' : '') + '>' + (language !== 'tutong' ? statusLabel(entry) : '') + entryDetails({note:entry.note,sourceFile:[...new Set(sourceRecords.map(record => record.sourceFile).filter(Boolean))].join(' · '),sourceUrl:sources[0]?.url,additionalSources:sources.slice(1)}) + '</div></article>';
  }
  function renderNumbers() {
    $('#numbers-toggle').setAttribute('aria-pressed',String(state.numbersHidden)); $('#numbers-toggle').textContent = state.numbersHidden ? 'Show all number words' : 'Hide number words';
    const container = $('#number-grid'), openStages = new Map([...container.querySelectorAll('[data-number-stage]')].map(stage => [stage.dataset.numberStage,stage.open]));
    const groups = Object.entries(catalog.numbers).filter(([language,records]) => records.length && (state.collection === 'all' || state.collection === language));
    $('#numbers-empty').hidden = groups.length !== 0; $('#numbers-toggle').disabled = !groups.length;
    const pending = ['brunei','dusun'].includes(state.collection) && !extra.loaded.includes(state.collection);
    $('#numbers-empty').textContent = pending ? 'Loading ' + names[state.collection] + ' numbers…' : extra.failed.includes(state.collection) ? names[state.collection] + ' could not load. Reload while connected to try again.' : state.collection === 'brunei' ? 'Brunei Malay number entries have not been added to this collection yet.' : 'No recorded numbers are available in this collection yet.';
    container.innerHTML = groups.map(([language,records]) => {
      const stages = BKCollections.countingStages(records);
      return '<section class="number-collection" aria-label="' + esc(names[language]) + ' numbers"><h2>' + esc(names[language]) + '<small>' + records.length + ' recorded numbers</small></h2>' + (language === 'dusun' ? '<p class="local-note counting-scope">Selected examples through 1,000. Siam and Walu’ for nine were confirmed by the maintainer; Walu for eight still needs review. The remaining forms retain their source and review labels.</p>' : '') + stages.map((stage,index) => {
        const key = language + ':' + stage.id, expanded = openStages.has(key) ? openStages.get(key) : stage.id !== 'building';
        const pairs = language === 'dusun' && stage.id === 'building' ? BKCollections.countingPairs(stage.entries) : [];
        const examples = pairs.length ? '<div class="counting-examples" ' + (state.numbersHidden ? 'hidden' : '') + '><h3>Notice how the recorded forms change</h3><p>Compare a whole ten with the next number in these source examples.</p><div>' + pairs.map(pair => '<dl>' + pair.map(entry => '<div><dt>' + numberText(entry.number) + '</dt><dd>' + esc(entry.word) + '</dd></div>').join('') + '</dl>').join('') + '</div><p class="local-note">Other tens and larger combinations still need source records or speaker review.</p></div>' : '';
        const pool = BKCollections.countingPracticePool(stage.entries);
        return '<details class="number-stage" data-number-stage="' + key + '" ' + (expanded ? 'open' : '') + '><summary><span class="number-step">0' + (index + 1) + '</span><span><strong>' + esc(stage.title) + '</strong><small>' + stage.entries.length + ' recorded numbers</small></span></summary><div class="number-stage-body"><p class="stage-intro">' + esc(stage.intro) + '</p>' + (language === 'dusun' && stage.id === 'milestones' ? '<p class="local-note">These milestones come from the SJD column of the 3 May 2013 Sang Jati comparison. Their source links are included below.</p>' : '') + examples + '<div class="number-grid">' + stage.entries.map(numberTile).join('') + '</div>' + (pool.length > 1 ? '<div class="number-check-start"><button class="text-button" type="button" data-start-number-check="' + stage.id + '" data-check-language="' + language + '">Quick check · ' + Math.min(3,pool.length) + ' questions →</button><small>Practise the recorded forms. Disputed readings stay outside scored checks.</small></div>' : '') + '<div class="number-check" data-number-check="' + key + '" hidden></div></div></details>';
      }).join('') + '</section>';
    }).join('');
    if (state.numberQuiz) renderNumberCheck();
  }
  function startNumberCheck(language,stageId) {
    const stage = BKCollections.countingStages(catalog.numbers[language] || []).find(item => item.id === stageId), pool = BKCollections.countingPracticePool(stage?.entries || []);
    if (pool.length < 2) return;
    const questions = BK.shuffle(pool).slice(0,3).map(entry => ({entry,choices:BK.shuffle([entry,...BK.shuffle(pool.filter(item => item.number !== entry.number)).slice(0,3)])}));
    state.numberQuiz = {language,stageId,questions,index:0,answers:[]}; state.numbersHidden = true;
    renderNumbers();
    const section = $('[data-number-stage="' + language + ':' + stageId + '"]'); section.open = true;
    section.querySelector('.number-check h3').focus({preventScroll:true}); section.querySelector('.number-check').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function renderNumberCheck() {
    const quiz = state.numberQuiz; if (!quiz) return;
    const container = $('[data-number-check="' + quiz.language + ':' + quiz.stageId + '"]'); if (!container) return; container.hidden = false;
    if (quiz.index >= quiz.questions.length) {
      const correct = quiz.answers.filter(Boolean).length;
      container.innerHTML = '<span class="section-kicker">Check complete</span><h3 tabindex="-1">' + correct + ' / ' + quiz.questions.length + '</h3><p>Revisit the recorded forms, then try another short check.</p><div class="number-check-actions"><button class="primary-button" type="button" data-start-number-check="' + quiz.stageId + '" data-check-language="' + quiz.language + '">Try again →</button><button class="text-button" type="button" data-review-number-cards>Review the cards</button></div>'; return;
    }
    const {entry,choices} = quiz.questions[quiz.index], answered = quiz.answers[quiz.index] !== undefined;
    container.innerHTML = '<span class="section-kicker">Recall check · ' + (quiz.index + 1) + ' of ' + quiz.questions.length + '</span><h3 tabindex="-1">' + esc(entry.word) + '</h3>' + (quiz.language !== 'tutong' ? statusLabel(entry) : '') + '<p>Which number is this?</p><div class="quiz-choices">' + choices.map(choice => '<button type="button" data-number-answer="' + choice.number + '" ' + (answered ? 'disabled' : '') + ' class="' + (answered && choice.number === entry.number ? 'correct' : '') + '">' + numberText(choice.number) + '</button>').join('') + '</div><p class="quiz-feedback" role="status">' + (answered ? (quiz.answers[quiz.index] ? 'Correct. ' : '') + esc(entry.word) + ' is ' + numberText(entry.number) + '.' : 'Number words are hidden above. Tap a card if you need a hint.') + '</p><button class="primary-button" type="button" data-next-number-question ' + (answered ? '' : 'hidden') + '>' + (quiz.index === quiz.questions.length - 1 ? 'See results' : 'Next question') + ' →</button>';
  }
  function initNumbers() {
    $('#number-grid').addEventListener('click',event => {
      const start = event.target.closest('[data-start-number-check]'); if (start) {startNumberCheck(start.dataset.checkLanguage,start.dataset.startNumberCheck); return;}
      const tile = event.target.closest('[data-number]');
      if (tile && state.numbersHidden) {
        const entry = catalog.numbers[tile.dataset.numberLanguage].find(item => item.number === Number(tile.dataset.number)), expanded = tile.getAttribute('aria-expanded') === 'true';
        tile.setAttribute('aria-expanded',String(!expanded)); tile.setAttribute('aria-label',numberText(entry.number) + ', ' + names[entry.language] + ', ' + (expanded ? 'reveal word' : entry.word));
        tile.querySelector('span').hidden = expanded; tile.querySelector('small').hidden = !expanded; tile.parentElement.querySelector('.number-details').hidden = expanded; return;
      }
      const quiz = state.numberQuiz; if (!quiz) return;
      const answer = event.target.closest('[data-number-answer]');
      if (answer && quiz.answers[quiz.index] === undefined) {
        const question = quiz.questions[quiz.index], selected = Number(answer.dataset.numberAnswer);
        if (!question.choices.some(choice => choice.number === selected)) return;
        quiz.answers[quiz.index] = selected === question.entry.number; markToday(); renderNumberCheck();
        const container = $('[data-number-check="' + quiz.language + ':' + quiz.stageId + '"]');
        if (!quiz.answers[quiz.index]) container.querySelector('[data-number-answer="' + selected + '"]').classList.add('wrong');
        container.querySelector('[data-next-number-question]').focus({preventScroll:true}); return;
      }
      if (event.target.closest('[data-next-number-question]') && quiz.answers[quiz.index] !== undefined) {quiz.index++; renderNumberCheck(); $('[data-number-check="' + quiz.language + ':' + quiz.stageId + '"] h3').focus({preventScroll:true});}
      if (event.target.closest('[data-review-number-cards]')) {state.numbersHidden = false; renderNumbers();}
    });
  }
  function wordSelection() {
    const ids = state.wordsList === 'mistakes' ? state.mistakes : state.wordsList === 'all' ? state.saved : new Set(state.lists.find(list => list.id === state.wordsList)?.words || []);
    return BK.findWords(catalog.words, {query:$('#words-search').value, collection:state.collection, savedOnly:true, saved:ids, sort:'az'}).results;
  }
  function renderWords() {
    const listSelect = $('#words-list'), options = JSON.stringify(state.lists.map(list => [list.id,list.name]));
    if (listSelect.dataset.options !== options) { listSelect.innerHTML = '<option value="all">All saved words</option><option value="mistakes">Review mistakes</option>' + state.lists.map(list => '<option value="' + esc(list.id) + '">' + esc(list.name) + '</option>').join(''); listSelect.dataset.options = options; }
    if (!['all','mistakes',...state.lists.map(list => list.id)].includes(state.wordsList)) state.wordsList = 'all';
    listSelect.value = state.wordsList;
    const results = wordSelection(), visible = results.slice(0,state.wordsPage * 36), container = $('#words-grid');
    for (const language of ['tutong','brunei','dusun']) {
      const words = visible.filter(word => word.language === language);
      let group = container.querySelector('[data-saved-language="' + language + '"]');
      if (!words.length) { group?.remove(); continue; }
      if (!group) { group = document.createElement('section'); group.dataset.savedLanguage = language; group.innerHTML = '<h2>' + esc(names[language]) + '</h2><div class="dictionary-grid"></div>'; container.append(group); }
      group.querySelector('h2').textContent = names[language] + ' · ' + results.filter(word => word.language === language).length;
      renderWordGrid(group.querySelector('.dictionary-grid'), words, true);
    }
    const unavailable = [...new Set([...state.saved,...state.mistakes])].filter(id => !validIds.has(id)).length;
    $('#words-availability').hidden = !unavailable;
    $('#words-availability').textContent = extra.loaded.length < 2 ? 'Your other saved words are loading. Their saved records and study lists are kept.' : unavailable + ' saved or review entries are not in the loaded collections. They remain in your progress backup; reload while connected to try again.';
    $('#words-result-label').textContent = results.length + (state.wordsList === 'mistakes' ? (results.length === 1 ? ' word to review' : ' words to review') : (results.length === 1 ? ' saved word' : ' saved words')) + ' · ' + names[state.collection];
    $('#practice-words').disabled = !results.some(word => word.english.trim());
    $('#review-mistakes').disabled = !catalog.words.some(word => state.mistakes.has(word.id) && (state.collection === 'all' || word.language === state.collection));
    $('#delete-list').hidden = ['all','mistakes'].includes(state.wordsList); $('#words-list-help').hidden = $('#delete-list').hidden;
    $('#words-empty').hidden = !!results.length; $('#words-more').hidden = visible.length >= results.length;
    $('#words-empty-title').textContent = state.wordsList === 'mistakes' ? 'A fresh start.' : $('#words-search').value ? 'No matching saved words.' : state.wordsList !== 'all' ? 'Make this list your own.' : 'Your first word is a beginning.';
    $('#words-empty-copy').textContent = state.wordsList === 'mistakes' ? 'Missed practice words will appear here. Correct answers clear them from the queue.' : state.wordsList !== 'all' ? 'Choose All saved words, then open Study lists on a word to add it here.' : 'Tap the heart on a dictionary entry to keep it here. You can also choose another language above.';
    if (!results.length && unavailable && !$('#words-search').value && state.wordsList === 'all') { $('#words-empty-title').textContent = 'Your saved words are kept.'; $('#words-empty-copy').textContent = 'Available words will appear here when their collection loads.'; }
    updateProgress();
  }
  function initWords() {
    $('#words-search').addEventListener('input', () => {state.wordsPage = 1; renderWords();});
    $('#words-list').addEventListener('change', event => {state.wordsList = event.target.value; state.wordsPage = 1; renderWords();});
    $('#words-more').addEventListener('click', () => {state.wordsPage++; renderWords();});
    $('#new-list').addEventListener('click', () => {$('#list-form').hidden = false; $('#list-name').focus();});
    $('#cancel-list').addEventListener('click', () => {$('#list-form').hidden = true; $('#new-list').focus();});
    $('#list-form').addEventListener('submit', event => {
      event.preventDefault(); const name = $('#list-name').value.trim(); if (!name) return;
      if (state.lists.length >= 20) {toast('You can keep up to 20 study lists.'); return;}
      if (state.lists.some(list => BK.normalize(list.name) === BK.normalize(name))) {toast('Choose a different list name.'); return;}
      const list = {id:'list-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8), name, words:[]};
      state.lists.push(list); state.wordsList = 'all'; state.wordsPage = 1; persist(); $('#list-form').hidden = true; $('#list-name').value = ''; renderWords(); $('#words-list').focus(); toast('List created. Add words using Study lists on each card.');
    });
    $('#delete-list').addEventListener('click', () => {state.lists = state.lists.filter(list => list.id !== state.wordsList); state.wordsList = 'all'; persist(); renderWords(); toast('Study list removed. Your saved words are still here.');});
    $('#practice-words').addEventListener('click', () => startPractice(wordSelection()));
    $('#review-mistakes').addEventListener('click', () => {state.wordsList = 'mistakes'; $('#words-search').value = ''; startPractice(wordSelection());});
  }
  function startPractice(words) {
    state.practiceWords = BK.shuffle(words.filter(word => word.english.trim())).slice(0,8); state.practiceIndex = 0; state.practiceAnswers = []; state.practiceAnswered = false;
    if (!state.practiceWords.length) {toast('Save a word with a translation to start practising.'); return;}
    routeTo('practice'); $('#practice-content h2')?.focus({preventScroll:true});
  }
  function renderPractice() {
    if (!state.practiceWords.length) { $('#practice-progress').textContent = 'Choose a saved word or study list to begin.'; $('#practice-content').innerHTML = '<h2>Make this practice your own.</h2><button class="primary-button" type="button" data-route="words">Choose words →</button>'; return; }
    if (state.practiceIndex >= state.practiceWords.length) {
      const missed = state.practiceAnswers.filter(answer => !answer.correct).map(answer => answer.word), score = state.practiceAnswers.length - missed.length;
      $('#practice-progress').textContent = 'Session complete';
      $('#practice-content').innerHTML = '<span class="section-kicker">Practice complete</span><h2 tabindex="-1">' + score + ' / ' + state.practiceWords.length + '</h2><p>' + (missed.length ? 'The words you missed are in your review queue.' : 'Every meaning matched. Your review queue is up to date.') + '</p>' + (missed.length ? '<button class="primary-button" id="practice-again" type="button">Review these ' + missed.length + (missed.length === 1 ? ' word →</button>' : ' words →</button>') : '') + '<button class="text-button" type="button" data-route="words">Back to My Words →</button>';
      $('#practice-again')?.addEventListener('click', () => startPractice(missed)); return;
    }
    const word = state.practiceWords[state.practiceIndex], answer = state.practiceAnswers[state.practiceIndex];
    $('#practice-progress').textContent = 'Word ' + (state.practiceIndex + 1) + ' of ' + state.practiceWords.length;
    // A collection update should not replace a question that has already been answered.
    if ($('#practice-content').dataset.question === word.id + ':' + state.practiceIndex && answer) return;
    $('#practice-content').dataset.question = word.id + ':' + state.practiceIndex;
    state.practiceAnswered = false;
    const pool = catalog.words.filter(item => item.language === word.language && item.english.trim()), choices = BK.choicesFor(word,pool);
    $('#practice-content').innerHTML = languageLabel(word) + '<h2 tabindex="-1">' + esc(word.tutong) + '</h2>' + (word.language !== 'tutong' ? statusLabel(word) : '') + '<p>Which meaning matches this word?</p><div class="quiz-choices">' + choices.map(choice => '<button type="button" data-practice-answer="' + choice.id + '"><span lang="ms">' + esc(choice.malay) + '</span><small lang="en">' + esc(choice.english) + '</small></button>').join('') + '</div><p id="practice-feedback" class="quiz-feedback" role="status"></p><button class="primary-button" id="practice-next" type="button" hidden>' + (state.practiceIndex === state.practiceWords.length - 1 ? 'See results' : 'Next word') + ' →</button>';
    $$('[data-practice-answer]').forEach(button => button.addEventListener('click', () => {
      if (state.practiceAnswered) return; state.practiceAnswered = true; const correct = Number(button.dataset.practiceAnswer) === word.id;
      state.practiceAnswers.push({word,correct});
      $$('[data-practice-answer]').forEach(choice => {choice.disabled = true; if (Number(choice.dataset.practiceAnswer) === word.id) choice.classList.add('correct');});
      if (!correct) button.classList.add('wrong');
      $('#practice-feedback').textContent = (correct ? 'Correct. ' : 'The answer is ') + word.malay + ' / ' + word.english + '.';
      $('#practice-next').hidden = false; $('#practice-next').focus(); recordAnswer(word,correct);
    }));
    $('#practice-next').addEventListener('click', () => {state.practiceIndex++; renderPractice(); $('#practice-content h2').focus({preventScroll:true});});
  }
  function updateCollections(snapshot) {
    if (!snapshot.loaded.length) return;
    extra = snapshot; catalog = BKCollections.build({words:WORDS, phrases:PHRASES, numbers:NUMBERS, brunei:extra.brunei, dusun:extra.dusun}); catalogRevision++;
    catalog.words.forEach(word => validIds.add(word.id)); BK.createSearchIndex(catalog.words); BK.createSearchIndex(catalog.phrases);
    const loadStatus = $('#collections-load-status'); loadStatus.hidden = extra.loaded.length === 2 && !extra.failed.length;
    loadStatus.textContent = extra.failed.length ? extra.failed.map(language => names[language]).join(' and ') + ' could not load. Available collections still work. Reload to try again.' : 'Tutong is ready. Loading the remaining language collection…';
    setCollection(state.collection); initTopics(); renderActive(); ui?.refreshSearch();
  }
  function bindEvents() {
    document.addEventListener('click', event => {
      const link = event.target.closest('[data-route]');
      if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {event.preventDefault(); routeTo(link.dataset.route, {collection:link.dataset.collection, query:link.dataset.query ?? (link.dataset.collection && link.dataset.route === 'dictionary' ? '' : undefined)}); return;}
      const save = event.target.closest('[data-save]'); if (save) toggleSaved(Number(save.dataset.save));
      const topic = event.target.closest('[data-category]');
      if (topic) {resetFilters(); state.dictionaryCategory = topic.dataset.category; $('#dictionary-search').value = ''; routeTo('dictionary');}
    });
    $('#words-grid').addEventListener('change', event => {
      const control = event.target.closest('[data-list-word]'); if (!control) return;
      const list = state.lists.find(item => item.id === control.dataset.studyList), id = Number(control.dataset.listWord);
      if (!list || !state.saved.has(id)) return;
      list.words = control.checked ? [...new Set([...list.words,id])] : list.words.filter(value => value !== id); persist();
      if (state.wordsList !== 'all') renderWords();
    });
    $('#home-search-form').addEventListener('submit', event => {event.preventDefault(); const input = $('#home-search-input'), query = input.value.trim(); if (!query) {input.value = ''; input.reportValidity(); return;} routeTo('dictionary',{query,collection:$('#home-collection').value});});
    $('#menu-button').addEventListener('click', () => {const open = $('#menu-button').getAttribute('aria-expanded') === 'true'; $('#menu-button').setAttribute('aria-expanded',String(!open)); $('#mobile-nav').hidden = open;});
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !$('#mobile-nav').hidden) {closeMenu(); $('#menu-button').focus();}
      if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) {event.preventDefault(); (state.route === 'dictionary' ? $('#dictionary-search') : state.route === 'home' ? $('#home-search-input') : null)?.focus();}
    });
    window.addEventListener('popstate',routeFromLocation); window.addEventListener('hashchange',routeFromLocation);
    $('#theme-toggle').addEventListener('click', () => {const night = document.documentElement.dataset.theme === 'night'; document.documentElement.dataset.theme = night ? '' : 'night'; store.write('bk-theme',night ? 'day' : 'night'); updateProgress(); $('#theme-toggle').setAttribute('aria-label',night ? 'Switch to dark theme' : 'Switch to light theme');});
    $('#daily-save').addEventListener('click', () => toggleSaved(dailyWord.id)); $('#next-quick').addEventListener('click',newQuick);
    $('#flashcard').addEventListener('click',revealCard); $('#lesson-prev').addEventListener('click', () => moveLesson(-1)); $('#lesson-next').addEventListener('click', () => moveLesson(1)); $('#lesson-know').addEventListener('click', () => state.revealed ? moveLesson(1) : revealCard());
    for (const [name,route] of [['home','home'],['dictionary','dictionary'],['phrase','phrases'],['numbers','numbers'],['words','words']]) $('#' + name + '-collection').addEventListener('change',event => {routeTo(route,{collection:event.target.value,historyMode:'replace',focus:false}); ui?.refreshSearch();});
    $('#numbers-toggle').addEventListener('click', () => {state.numbersHidden = !state.numbersHidden; renderNumbers();});
    $('#feedback-form').addEventListener('submit',event => {event.preventDefault(); const message = $('#feedback-message').value.trim(); if (!message) {$('#feedback-message').focus(); return;} location.href = 'mailto:sam@bahasa-kitani.xyz?subject=' + encodeURIComponent('[Bahasa Kitani] ' + $('#feedback-type').value) + '&body=' + encodeURIComponent(message); $('#feedback-status').textContent = 'Email draft requested. Review and send it in your email app, or email sam@bahasa-kitani.xyz directly.';});
  }
  function boot() {
    const night = store.read('bk-theme','day',value => ['day','night'].includes(value)) === 'night'; document.documentElement.dataset.theme = night ? 'night' : '';
    $('#theme-toggle').setAttribute('aria-label',night ? 'Switch to light theme' : 'Switch to dark theme');
    bindEvents(); initDaily(); initTopics(); initDictionary(); initPhrases(); initNumbers(); initWords(); newQuick(); updateProgress(); setCollection(state.collection); routeFromLocation();
    ui = BKUI.init({
      getWords:() => catalog.words, getCollection:() => state.collection, lessonSize:lessonWords.length,
      openSearch:(query,collection) => routeTo('dictionary',{query,collection:collection || state.collection}),
      ensureCatalog:async () => {await catalogReady; if (extra.failed.length) throw new Error('Load all language collections before restoring a backup. Reload while connected, then try again.'); return validIds;},
      getProgress,
      applyProgress:data => {
        state.saved = new Set(data.saved); state.learned = new Set(data.learned); state.mistakes = new Set(data.mistakes || []); state.lists = data.lists || []; state.days = data.days; state.lessonIndex = data.lessonIndex; state.wordsList = 'all';
        state.revealed = false; state.lessonMode = 'cards'; state.practiceWords = []; $('#practice-content').dataset.question = '';
        document.documentElement.dataset.theme = data.theme === 'night' ? 'night' : ''; $('#theme-toggle').setAttribute('aria-label',data.theme === 'night' ? 'Switch to light theme' : 'Switch to dark theme');
        const writes = [persist(),store.write('bk-days',data.days),store.write('bk-theme',data.theme)]; updateDailySave(); renderActive(); return writes.every(Boolean);
      }
    });
    catalogReady = BKCollections.load(updateCollections);
    $('#copyright-year').textContent = new Date().getFullYear();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(() => {});
  }
  boot();
})();
