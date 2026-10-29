/* Homepage suggestions and local progress backup. */
(() => {
  function init({ getWords, getCollection, ensureCatalog, lessonSize, openSearch, getProgress, applyProgress }) {
    const $ = selector => document.querySelector(selector);
    const form = $('#home-search-form'), input = $('#home-search-input'), list = $('#home-search-suggestions');
    const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
    let active = -1;
    function closeSuggestions() { list.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    function suggestions() {
      const query = input.value.trim();
      if (!query) { closeSuggestions(); return; }
      const found = BK.findWords(getWords(), { query, collection:getCollection() }), matches = found.results.slice(0,6);
      active = -1; input.removeAttribute('aria-activedescendant');
      list.innerHTML = matches.length ? '<p role="presentation">' + (found.approximate ? 'Closest spellings — choose a word' : 'Suggested entries') + '</p>' + matches.map(word => '<button type="button" tabindex="-1" role="option" aria-selected="false" id="home-suggest-' + word.id + '" data-suggest="' + word.id + '"><strong>' + esc(word.tutong) + '</strong><span class="suggestion-language">' + esc(BKCollections.names[word.language] + (word.language === 'tutong' ? '' : ' · ' + BKCollections.statusLabel(word.status))) + '</span><small>' + esc(word.malay) + ' · ' + esc(word.english) + '</small></button>').join('') : '<p role="presentation">No suggestions yet. Press Search to try the full dictionary.</p>';
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      list.querySelectorAll('[data-suggest]').forEach(button => {
        button.addEventListener('click', () => { const word = getWords().find(item => item.id === Number(button.dataset.suggest)); if (!word) return; input.value = word.tutong; closeSuggestions(); openSearch(word.tutong,word.language); });

      });
    }
    input.addEventListener('input', suggestions);
    input.addEventListener('keydown', event => {
      const buttons = [...list.querySelectorAll('button')];
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !list.hidden && buttons.length) {
        event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons.forEach((button,index) => button.setAttribute('aria-selected', String(index === active)));
        input.setAttribute('aria-activedescendant', buttons[active].id); buttons[active].scrollIntoView({ block:'nearest' });
      }
      if (event.key === 'Enter' && !list.hidden && active >= 0) { event.preventDefault(); buttons[active].click(); }
      if (event.key === 'Escape') closeSuggestions();
    });
    form.addEventListener('submit', closeSuggestions);
    form.addEventListener('focusout', event => { if (!form.contains(event.relatedTarget)) closeSuggestions(); });
    document.addEventListener('click', event => { if (!form.contains(event.target)) closeSuggestions(); });
    window.addEventListener('popstate', closeSuggestions);
    const dialog = $('#backup-dialog'), status = $('#backup-status'), fileInput = $('#backup-file'), restore = $('#restore-progress');
    let validIds = new Set();
    let pending = null, request = 0;
    $('#open-backup').addEventListener('click', () => {
      pending = null; request++; fileInput.value = ''; restore.disabled = true; $('#backup-preview').hidden = true;
      $('#backup-merge').checked = true; $('#backup-replace-note').hidden = true;
      status.textContent = 'Download a backup, or choose a file to preview before restoring. Files are processed on this device.';
      dialog.showModal();
    });
    $('#close-backup').addEventListener('click', () => dialog.close());
    $('#download-progress').addEventListener('click', () => {
      const file = BK.createProgressBackup(getProgress());
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type:'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'bahasa-kitani-progress-' + BK.dayKey() + '.json';
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Backup download started. Keep the file to restore your saved words and progress later.';
    });
    fileInput.addEventListener('change', async () => {
      const token = ++request, file = fileInput.files[0]; pending = null; restore.disabled = true; $('#backup-preview').hidden = true;
      if (!file) return;
      try {
        if (file.size > 1000000) throw new Error('Choose a backup smaller than 1 MB.');
        status.textContent = 'Checking the backup and available language collections…';
        const backup = BK.parseProgressBackup(await file.text(), lessonSize);
        validIds = await ensureCatalog();
        if (token !== request) return;
        pending = backup;
        const available = ids => ids.filter(id => validIds.has(id)).length;
        const unavailable = new Set([...backup.data.saved, ...backup.data.learned].filter(id => !validIds.has(id))).size;
        const count = (number, singular, plural = singular + 's') => number + ' ' + (number === 1 ? singular : plural);
        $('#backup-preview').textContent = [count(available(backup.data.saved),'saved word'), count(available(backup.data.learned),'practised word'), count(backup.data.days.length,'practice day'), count((backup.data.lists || []).length,'study list'), count((backup.data.mistakes || []).length,'review word')].join(' · ') + '.' + (unavailable ? ' ' + count(unavailable,'unavailable entry','unavailable entries') + ' will be skipped.' : '');
        $('#backup-preview').hidden = false; restore.disabled = false;
        status.textContent = 'Backup checked. Choose merge or replace, then restore when ready. Nothing has changed yet.';
      } catch (error) { if (token === request) status.textContent = error.message; }
    });
    document.querySelectorAll('[name="backup-mode"]').forEach(control => control.addEventListener('change', () => {
      $('#backup-replace-note').hidden = !$('#backup-replace').checked;
    }));
    restore.addEventListener('click', () => {
      if (!pending) return;
      try {
        const mode = $('#backup-replace').checked ? 'replace' : 'merge';
        const result = BK.restoreProgress(getProgress(), pending.data, { mode, validIds, lessonSize });
        const persisted = applyProgress(result.data); restore.disabled = true; pending = null;
        status.textContent = (persisted ? 'Progress restored in this browser.' : 'Progress restored for this visit; browser storage is unavailable.') + (result.missing ? ' Unavailable entries were skipped.' : '');
      } catch (error) { status.textContent = error.message; }
    });
    return { refreshSearch: () => { if (document.activeElement === input) suggestions(); else closeSuggestions(); } };
  }
  globalThis.BKUI = Object.freeze({ init });
})();
