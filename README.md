# Bahasa Kitani

A living Bahasa Tutong dictionary and learning site at [bahasa-kitani.xyz](https://bahasa-kitani.xyz), with Bahasa Melayu and English translations.

## What is included

- Search at the top of the homepage and across Tutong, Malay, English and entry notes; categories, sorting and saved words. Homepage searches open the full dictionary and keep the query in a shareable URL.
- Daily vocabulary, Quick Practice with paired Malay/English answers, and an eight-word lesson followed by a quiz, score and missed-word review.
- A phrasebook and number recall practice for 1–30.
- Progress, saved words, streaks and theme preferences stored in the visitor’s browser.
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
| data/tutong.js | Words, phrases and numbers; the source of truth |
| dictionary.html and redirect.js | Compatibility for old dictionary URLs, including ?q= searches |
| sw.js and manifest.webmanifest | Offline caching and home-screen metadata |
| CNAME | Custom domain for GitHub Pages |
| .nojekyll | Serve the repository as static files |
| admin/index.html and admin/admin.js | Credential-free local code generator for words and phrases |
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

Edit `data/tutong.js` or use the entry generator at `/admin/index.html`. The generator creates pasteable JavaScript; it does not write to GitHub or authenticate a server. Its next IDs are calculated from the actual corpus, and quotes/newlines in generated values are escaped with JSON.stringify. Use the generated ID rather than copying the ID of an existing entry. The generator also preserves higher IDs already reserved in your browser. The former client-side password gate has been removed; no credentials are needed for generating local text. Actual repository edits require GitHub authentication.

Every entry needs a unique numeric id, tutong, malay, english and cat. Keep note and notation where applicable. Valid notation values include variant, loanword, clarify or an empty string. Keep regional variants and uncertainty notes intact. After editing, run `npm test` and review the entry on the site.

## Offline updates and local progress

The service worker tries the network first for the public app files and uses its cached copy when offline. It does not cache admin pages, email contents, GitHub or third-party requests. A missing JavaScript file does not receive an HTML fallback. Old cache cleanup is restricted to Bahasa Kitani caches.

Bump the VERSION in sw.js and the version in package.json when releasing cached-file changes. Update the version suffixes on changed CSS and JavaScript URLs in index.html so a new page load receives the current assets. Online requests revalidate core files instead of accepting stale browser cache entries. A newly installed worker waits for existing tabs to close before activation. Offline availability begins after a successful online visit and cache installation; unsupported browsers can still use the online site.

Progress stays in one browser on one device. Clearing site data removes it. If browser storage is blocked or corrupt, the app keeps running with progress for the current visit. No accounts, analytics or progress-sync service are used.

## Recovery

The previous site is recoverable from commit 0cf4ea18c55d8044d7ee51c416d16a825f313950. To roll back a release, revert its commit through GitHub, then wait for Pages to deploy the revert. Keep data/tutong.js and CNAME when resolving changes. Raise the service-worker VERSION for a subsequent corrective release if cached files change.

## Content use

Free for education and personal research. Commercial use requires written permission. Contact sam@bahasa-kitani.xyz for corrections or permission requests.
