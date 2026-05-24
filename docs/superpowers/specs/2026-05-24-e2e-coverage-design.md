# E2E Test Coverage Design

**Date:** 2026-05-24
**Branch:** 110-codebase-simplification-pass
**Status:** Approved

## Goal

Extend the existing Playwright e2e suite to cover the full app surface: login flow, main
page, torrent actions, file tree, modals, and app settings. All tests run against a real
Electron binary and a real qBittorrent-nox instance in Docker.

---

## Architecture

### Single Playwright project, Docker always on

One flat Playwright project. `globalSetup.ts` starts a qBittorrent-nox Docker container
unconditionally before any tests run. `globalTeardown.ts` stops it after all tests finish.
The 2-5 second container boot is amortized across the full suite.

No project split, no `QB_E2E` env var gate. Docker is a hard requirement for running e2e
tests - this is acceptable because tests only run in CI (GitHub Actions `ubuntu-latest`
always has Docker) and locally only when debugging.

### Fixture torrent

A multi-file `.torrent` file committed to `e2e/fixtures/test.torrent`, containing:

```
test-files/
  hello.txt   ("hello")
  world.txt   ("world")
```

Generated once via a Node.js bencode script during implementation. `globalSetup` adds it
to qBittorrent **paused** via the API before any test runs. All torrent-action and
file-tree tests operate on this single seeded row. `globalTeardown` deletes it.

### Isolation per test

- Each test gets a fresh Electron `userDataDir` (isolated SQLite database, no saved servers)
- Tests that need to be on the main page use a `launchAppOnMainPage()` helper that:
  1. Launches the app
  2. Adds the qBittorrent server via `page.evaluate(() => window.bitbutler.server.add(...))`
  3. Clicks Connect and waits for the main page

### Page Object Model

One class per page/modal. All locators live in the POM - no inline locators in spec files.

### Locator strategy

All selectable elements in Angular templates get a `data-testid` attribute. Tests use
Playwright's `getByTestId()` API exclusively for element selection:

```html
<!-- Angular template -->
<button data-testid="connect-button" class="btn btn-primary" ...>
  {{ 'pages.login.connect' | translate }}
</button>
```

```typescript
// POM class
readonly connectButton = this.page.getByTestId('connect-button');
```

`getByTestId()` is language-independent (survives i18n), survives Bootstrap/style
refactors, and communicates test intent directly in the template.

`getByRole()` / `getByLabel()` / `getByPlaceholder()` may be used for form inputs where
the label or placeholder is the natural identifier and language is always English in tests
(clean `userDataDir` always boots in the default locale). `getByTestId()` is preferred
wherever ambiguity exists.

The two existing spec files (`app-startup`, `server-management`) currently use CSS class

- text locators. These will be retrofitted to use `getByTestId()` as part of this work.

---

## File Structure

```
e2e/
  globalSetup.ts                   start qBittorrent-nox container, seed fixture torrent
  globalTeardown.ts                stop container
  helpers/
    electron.ts                    (existing, unchanged)
    qbittorrent.ts                 Docker lifecycle + qB REST API helpers
  pages/
    login.page.ts
    main.page.ts
    server-editor.modal.ts
    settings.modal.ts
    torrent-actions.modal.ts       covers rename, set-category, set-location, delete
    file-tree.modal.ts
    manage-categories.modal.ts
    manage-tags.modal.ts
    confirm.modal.ts
  fixtures/
    test.torrent                   multi-file fixture torrent
  tests/
    app-startup.spec.ts            (existing, unchanged)
    server-management.spec.ts      (existing, unchanged)
    login-flow.spec.ts             new
    main-page.spec.ts              new
    add-torrent.spec.ts            new
    torrent-actions.spec.ts        new
    file-tree.spec.ts              new
    modals.spec.ts                 new
    settings.spec.ts               new
```

`playwright.config.ts` gets `globalSetup` and `globalTeardown` wired in. No other
structural changes.

---

## npm Scripts

```json
"test:e2e":           "playwright test",
"test:e2e:ci":        "xvfb-run --auto-servernum playwright test",
"test:e2e:server:ci": "xvfb-run --auto-servernum playwright test"
```

Both CI jobs use the same command. The no-server tests run in both jobs - the overlap is
acceptable (they are fast and stateless).

---

## Test Case Inventory

### `app-startup.spec.ts` (existing - 4 tests, unchanged)

- Shows the login page (brand title)
- Shows the version badge
- Connect button is disabled with no servers
- Add server button is enabled

### `server-management.spec.ts` (existing - 3 tests, unchanged)

- Clicking Add Server opens the server editor modal
- Server editor modal has a name input
- Dismissing the modal returns to login page

### `login-flow.spec.ts` (new - 2 tests)

- Successful login navigates to `/pages/main`
- Failed login (wrong password) shows error toast and stays on login page

### `main-page.spec.ts` (new - 4 tests)

- Torrent grid renders with the seeded fixture torrent row visible
- Button bar is visible
- Pause All button changes the fixture torrent state to paused
- Status bar is visible

### `add-torrent.spec.ts` (new - 1 test)

- Add torrent via `.torrent` file → new row appears in the grid

### `torrent-actions.spec.ts` (new - 4 tests)

- Rename torrent (display name) → new name visible in grid row
- Set category → category label visible in grid row
- Set save location → location updated (verified via qB API)
- Delete torrent with "delete files" checked → row disappears from grid
  - Note: this test adds its own throwaway torrent and deletes that, not the shared
    fixture torrent - so subsequent spec files still find the fixture row in the grid

### `file-tree.spec.ts` (new - 2 tests)

- File tree shows `hello.txt` and `world.txt`
- Rename `hello.txt` → `renamed.txt` → new name visible in the tree

### `modals.spec.ts` (new - 3 tests)

- Manage categories: add a category, it appears in the category list
- Manage tags: add a tag, it appears in the tag list
- Confirm modal: clicking Cancel on delete keeps the torrent in the grid

### `settings.spec.ts` (new - 3 tests)

- Settings modal opens from the button bar
- Switching theme updates the logo/body class
- Closing settings without saving produces no error

**Total: 26 tests across 9 spec files**

---

## Docker / qBittorrent Setup

- **Image:** `qbittorrentofficial/qbittorrent-nox:5.2.0-1` (pinned; update when upgrading)
- **Port:** `18080:8080` (non-standard to avoid conflicts with local qBittorrent)
- **Credentials:** `admin` / `adminadmin` (default, set via env vars on the image)
- **globalSetup sequence:**
  1. `docker rm -f bitbutler-e2e-qb` (clean any leftover)
  2. `docker run -d --name bitbutler-e2e-qb -p 18080:8080 ...`
  3. Poll `GET /api/v2/app/version` until 200 (max 30 attempts × 500 ms)
  4. `POST /api/v2/torrents/add` with the fixture `.torrent` file and `paused=true`
  5. Write `{ QB_HOST, QB_PORT, QB_USER, QB_PASS }` to `process.env` for specs to read
- **globalTeardown:** `docker rm -f bitbutler-e2e-qb`

---

## CI Changes

### Existing `e2e` job

Rename to `e2e-no-server`. Runs `test:e2e:ci` (no Docker needed, no structural changes).

### New `e2e-server` job

```yaml
e2e-server:
  name: '[6/7] E2E Tests - Server (Playwright / Electron / qBittorrent)'
  runs-on: ubuntu-latest
  needs: [detect-changes, test-app, test-electron, e2e-no-server]
  if: >-
    always() &&
    needs.detect-changes.outputs.any-source == 'true' &&
    !contains(needs.*.result, 'failure') &&
    !contains(needs.*.result, 'cancelled')
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: '24'
        cache: 'npm'
    - run: npm install -g npm@11
    - run: npm ci
    - name: Install display and system libs
      run: |
        sudo apt-get update -qq
        sudo apt-get install -y xvfb libnss3 libgbm1 libasound2t64 libgtk-3-0 \
          libxss1 libxkbcommon0 libatk-bridge2.0-0 libcups2 libdrm2
    - name: Build Angular app
      run: npm run build
    - name: Build Electron TypeScript
      run: npm run build:electron
    - name: Run Playwright e2e server tests
      run: npm run test:e2e:server:ci
```

### `build` job

`needs` updated to include both `e2e-no-server` and `e2e-server`. Job label updated to
`[7/7]`.
