# Bahasa Kitani

An independently developed and maintained, work-in-progress collection for Brunei's living languages, built around the original Bahasa Tutong dictionary and learning site at [bahasa-kitani.xyz](https://bahasa-kitani.xyz), with Bahasa Melayu and English translations.

## What is included

- One indexed search across Tutong, Brunei Malay and Dusun, with keyboard suggestions, spelling variants, Malay/English meanings and shareable language/query links. Optional topic, review, saved-word and sorting controls live under Filters.
- Daily vocabulary, Quick Practice with paired Malay/English answers, and an eight-word lesson followed by a quiz, score and missed-word review.
- A Learn hub for the Tutong lesson, a searchable three-language phrasebook and Tutong/Dusun counting recall. Existing source notes and review labels remain visible.
- My Words groups saved entries by language, supports up to 20 named study lists, and offers bilingual practice sessions of up to eight words. Missed practice words enter a persistent review queue; correct answers remove them.
- Progress, study lists, review words, streaks and theme preferences stay in the visitor’s browser, with downloadable JSON backups, preview, merge and replace restore.
- Responsive navigation, keyboard support, dark mode and a small offline cache.
- A feedback form that opens an email draft to sam@bahasa-kitani.xyz.

The dictionary data is community-sourced. Regional spellings and translations may need review by fluent speakers. Existing source credits are retained: community contributions and DBP Kamus Tutong–Melayu (1991). Audio has not been synthesized.

## Files

| Path | Purpose |
| --- | --- |
| index.html | Public page and views |
| styles.css | Responsive light/dark styles |
| app.js | UI, lessons, saved words and progress |
| core.js | Search, dates, storage and quiz helpers |
| data/tutong.js | Original Tutong words, phrases and numbers |
| data/brunei.json and data/dusun.json | Source-linked additional language records and review history |
| collections.js | Shared adapters, standard topic labels, stable saved IDs and background loading |
| dictionary.html, languages.html and redirect.js | Compatibility for old dictionary/language URLs, preserving search and language selection |
| sw.js and manifest.webmanifest | Offline caching and home-screen metadata |
| CNAME | Custom domain for GitHub Pages |
| .nojekyll | Serve the repository as static files |
| admin/index.html, admin/admin.js and admin/editor.css | Contributor editor, local drafts, preview and review links |
| contributor-core.js | Shared entry formatting, duplicate checks and proposal validation |
| enhancements.js | Search suggestions and local progress backup dialog |
| scripts/process-contribution.cjs and .github/workflows/contributions.yml | Maintainer-approved contribution staging |
| scripts/ and tests/ | Dependency-free validation and regression tests |
| .github/workflows/checks.yml | Run checks on pushes and pull requests |

## Check and preview locally

Use Node.js 22 or newer (CI uses 24). No dependency install is needed:

```sh
npm test
python3 -m http.server 8000
```

Then open http://localhost:8000. Use a local HTTP server rather than opening the HTML directly so paths, storage and the service worker behave correctly. The tests cover source data, search, unique quiz answers, saved progress, streak dates, admin IDs, and offline fallback behavior. Phone and desktop browser checks complement these tests.

## Publishing

The site uses the existing GitHub Pages deployment from **main / repository root**. Commit the root HTML, JavaScript, CSS, data, CNAME and .nojekyll files together. No dist folder, build service, secret, npm install or domain migration is needed.

1. Run `npm test` before pushing.
2. Push the checked source to main.
3. In GitHub → Actions, wait for **Site checks** and **pages build and deployment** to complete successfully.
4. Visit https://bahasa-kitani.xyz and check the changed feature.

For a fresh setup, select **Settings → Pages → Deploy from a branch → main / (root)**, with custom domain **bahasa-kitani.xyz**. Existing domain records should be retained. GitHub provisions HTTPS for the configured domain.

A push to main publishes through Pages; the Site checks workflow reports validation separately. To require checks before changes reach main, configure branch protection and use pull requests. This release does not change repository protection settings.

## Adding words and phrases

Open /admin/index.html, now the contributor editor. It supports new words and phrases, searching and editing existing entries, duplicate warnings, local drafts, a preview, and code export matching the dictionary style:

    { id:766, tutong:"Example", malay:"Contoh", english:"Example", cat:"Actions", notation:"", note:"" },

The unquoted field names are intentional JavaScript; text values remain quoted and escaped safely. Keep the generated IDs for manual code exports.

### Reviewed contribution workflow

1. Fill in an entry or find an existing word to edit, then **Save draft**.
2. Select **Continue on GitHub**, review the prefilled public issue and submit it there.
3. A maintainer reviews the translations and applies the **dictionary-approved** label.
4. The **Dictionary contributions** workflow checks the approver’s repository permission, validates the proposal as JSON, checks duplicate and stale entries, and creates a contribution branch. It reserves IDs from other staged contribution branches.
5. Follow the pull-request link posted on the issue, open the pull request, wait for **Site checks** and merge to publish.

The approval label is created automatically when the workflow is installed on main. Approval prepares a branch; it never commits directly to main or automatically publishes vocabulary. A human opens the pull request so the usual checks run, then merges it. If main changes during review, reapply the label to prepare a new change against current data. Identical repeat approvals reuse the prepared branch. Published entry IDs stay unchanged when editing.

Drafts remain in the current browser until submitted. Proposals submitted to GitHub are public. No GitHub tokens, passwords or private keys are collected by the web page. Authentication and publication happen on GitHub. The workflow uses only GitHub’s short-lived job token with repository contents and issue permissions; no extra hosting or secrets are needed.

The code-export panel remains available for manually editing data/tutong.js. Place a word before the closing ]; of WORDS or a phrase before PHRASES closes. Categories and notation are validated; every entry must have a unique positive integer ID. Run npm test and review the published entry after editing.

### Progress backup

In **My Words**, select **Back up or restore**. Download a JSON file, or choose one to preview before importing. Merge preserves current progress and combines saved words, practice dates, learned words, review words and study-list membership. Lists with the same ID keep the current name. Replace with an older backup clears lists and the review queue because those fields were not present in that file. Replace uses the backup instead and displays a warning first. Invalid files, unsupported versions, malformed IDs or dates, and files larger than 1 MB are rejected before state changes. Entries no longer in the dictionary are reported and skipped. Files are parsed on the device; there is no upload or account requirement.

## Offline updates and local progress

The service worker reuses installed CSS/JavaScript when the requested release version matches its own. Pages and vocabulary try the network first and fall back to cache, keeping reviewed content current. Cached navigation falls back after three seconds on a slow connection while a late response refreshes the cache. A newer page’s versioned assets always reach the network through an older worker and do not overwrite that worker’s offline assets. It does not cache admin pages, email contents, GitHub or third-party requests. A missing JavaScript file does not receive an HTML fallback. Old cache cleanup is restricted to Bahasa Kitani caches.

Bump the VERSION in sw.js and the version in package.json when releasing cached-file changes. Update the version suffixes on changed CSS and JavaScript URLs in index.html so a new page load receives the current assets. Keep release-version asset query strings aligned with the service-worker VERSION. Vocabulary data revalidates regardless of its query string. A newly installed worker waits for existing tabs to close before activation. Offline availability begins after a successful online visit and cache installation; unsupported browsers can still use the online site.

Progress stays in one browser on one device. Clearing site data removes it. If browser storage is blocked or corrupt, the app keeps running with progress for the current visit. No accounts, analytics or progress-sync service are used.

## Recovery

The previous site is recoverable from commit 0cf4ea18c55d8044d7ee51c416d16a825f313950. To roll back a release, revert its commit through GitHub, then wait for Pages to deploy the revert. Keep data/tutong.js and CNAME when resolving changes. Raise the service-worker VERSION for a subsequent corrective release if cached files change.

## Content use

Free for education and personal research. Commercial use requires written permission. Contact sam@bahasa-kitani.xyz for corrections or permission requests.

### Bahasa Tutong section badge

The homepage learning introduction uses the B3 map-and-book badge in `assets/bahasa-tutong-badge.svg`. The main Bahasa Kitani brand and favicon remain the site identity. The badge preserves the district path from [Locator map Tutong in Brunei.svg](https://commons.wikimedia.org/wiki/File:Locator_map_Tutong_in_Brunei.svg), created by Tachymètre in 2011 and released into the public domain. Only uniform scaling, translation and colour were applied to the boundary.

## Shared language collections and organisation

The four primary destinations are Home, Dictionary, Learn and My Words. Phrases and Numbers live under Learn; old hash routes still work. `languages.html` redirects to the main Dictionary and preserves `?lang=`, `?q=` and the old `#tutong`, `#brunei` and `#dusun` selections. There is one search implementation and one dictionary interface.

`collections.js` adapts all three datasets without changing source files, record IDs, meanings or review history. The common topic labels are presentation metadata; an original category is retained as `sourceCategory` and shown in entry notes when different. Broad source categories remain broad rather than guessing a word’s meaning. Tutong IDs stay unchanged; additional-language saved IDs derive stably from language and source ID.

Tutong controls initialise immediately. The two JSON collections load once per visit, publish independently as they arrive, and time out individually after eight seconds. Existing foreign saved IDs and list membership are retained during loading or failures. Backup downloads are always available; restore waits for both datasets so a temporary loading problem cannot discard saved vocabulary. No hidden route is pre-rendered at boot. Searchable forms are prepared once for each catalogue, and unchanged dictionary cards keep their DOM nodes, including expanded notes.

Phrasebook entries reuse recorded Tutong phrases, the Brunei Malay expressions `brunei-053` and `brunei-144`, and the Dusun Greetings records. Number variants remain grouped by value. Siam and Walu’ for nine are maintainer checked; Walu for eight still needs review. Brunei Malay counting has an explicit empty state until supplied.

### Context and pronunciation

Word cards can link to existing phrases containing their headword. Checked `usageExamples` (such as the maintainer’s Tah examples) are shown with the recorded explanation. No new translations are inferred. The optional `examples` field accepts `{text, malay?, english?, explanation?, status:"reviewed", credit?}`. Other statuses stay unpublished.

An optional `audio` field accepts `{url, speaker, status:"reviewed"}`. Audio controls appear only for checked recordings with a speaker credit and an HTTPS URL or an `assets/audio/` MP3, OGG or WAV path. Audio loads only on demand (`preload="none"`). No recordings are currently supplied. Contributors should submit authentic recordings with the speaker’s permission for maintainer review; the Tutong contributor editor’s existing word/phrase workflow remains available.

### Backup compatibility

The JSON envelope remains version 1, with optional `mistakes` (word IDs) and `lists` (`{id, name, words}`) fields. Existing backups still import. Lists are validated, limited to 20 and only contain saved IDs; restore validates all IDs against the loaded catalogue. Clearing local site data removes progress; a downloaded backup can restore it on another device. There is no account or automatic cloud sync.
