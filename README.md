# Bahasa Kitani

A living Bahasa Tutong dictionary and learning site at [bahasa-kitani.xyz](https://bahasa-kitani.xyz), with Bahasa Melayu and English translations.

## What is included

- Search with live homepage suggestions, relevance ranking, slash-separated variants, multiword matching, language filters and clearly labelled spelling suggestions. Categories, saved words and shareable query links remain available.
- Daily vocabulary, Quick Practice with paired Malay/English answers, and an eight-word lesson followed by a quiz, score and missed-word review.
- A phrasebook and number recall practice, including 1–30 and additional contributed numbers.
- Progress, saved words, streaks and theme preferences stored in the visitor’s browser, with downloadable JSON backups, preview, merge and replace restore.
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

On the homepage, select **Back up or restore progress**. Download a JSON file, or choose one to preview before importing. Merge preserves current progress and adds the backup’s saved words, practice dates and learned words. Replace uses the backup instead and displays a warning first. Invalid files, unsupported versions, malformed IDs or dates, and files larger than 1 MB are rejected before state changes. Entries no longer in the dictionary are reported and skipped. Files are parsed on the device; there is no upload or account requirement.

## Offline updates and local progress

The service worker tries the network first for the public app files and uses its cached copy when offline. It does not cache admin pages, email contents, GitHub or third-party requests. A missing JavaScript file does not receive an HTML fallback. Old cache cleanup is restricted to Bahasa Kitani caches.

Bump the VERSION in sw.js and the version in package.json when releasing cached-file changes. Update the version suffixes on changed CSS and JavaScript URLs in index.html so a new page load receives the current assets. Online requests revalidate core files instead of accepting stale browser cache entries. A newly installed worker waits for existing tabs to close before activation. Offline availability begins after a successful online visit and cache installation; unsupported browsers can still use the online site.

Progress stays in one browser on one device. Clearing site data removes it. If browser storage is blocked or corrupt, the app keeps running with progress for the current visit. No accounts, analytics or progress-sync service are used.

## Recovery

The previous site is recoverable from commit 0cf4ea18c55d8044d7ee51c416d16a825f313950. To roll back a release, revert its commit through GitHub, then wait for Pages to deploy the revert. Keep data/tutong.js and CNAME when resolving changes. Raise the service-worker VERSION for a subsequent corrective release if cached files change.

## Content use

Free for education and personal research. Commercial use requires written permission. Contact sam@bahasa-kitani.xyz for corrections or permission requests.
