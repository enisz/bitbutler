---
title: 'Development'
order: 4
slug: 'development'
---

# Development

How to set up, run, and build BitButler from source.

## Prerequisites

- **Node.js** — LTS release recommended.
- **npm** — comes with Node.js.
- A running [qBittorrent-nox](https://github.com/qbittorrent/qBittorrent) instance to connect to during development.

## Getting the Source

```bash
git clone https://github.com/enisz/bitbutler.git
cd bitbutler
npm install
```

The repository is a monorepo. Running `npm install` at the root installs dependencies for all packages.

## Common Commands

| Command              | Description                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm start`          | Starts the Angular dev server and Electron concurrently. This is the main command for day-to-day development. |
| `npm run serve`      | Starts only the Angular dev server (without Electron).                                                        |
| `npm run lint`       | Runs ESLint across the codebase. Zero warnings are allowed.                                                   |
| `npm run lint:fix`   | Runs ESLint and automatically fixes any fixable issues.                                                       |
| `npm run format`     | Runs Prettier to format all files in the codebase.                                                            |
| `npm test`           | Runs the test suite.                                                                                          |
| `npm run build`      | Produces an Angular production build.                                                                         |
| `npm run dist:linux` | Builds distributable packages for Linux: AppImage, DEB, RPM, Snap, and tar.gz.                                |
| `npm run dist:win`   | Builds distributable packages for Windows: NSIS installer, portable EXE, and ZIP.                             |

## Project Layout

```
packages/app/                     // Angular renderer (the UI)
packages/app/src/app/pages/       // Lazy-loaded route pages
packages/app/src/app/components/  // Shared UI components & modals
packages/app/src/app/services/    // Business logic and state
packages/app/src/app/models/      // TypeScript interfaces and types
packages/app/src/styles/themes/   // SCSS theme files
packages/app/public/i18n/         // Translation files (us.json, hu.json)
packages/electron/src/            // Electron main process
packages/electron/src/preload.ts  // IPC bridge (contextBridge)
packages/electron/src/ipc/        // IPC handler modules
packages/electron/src/db.ts       // SQLite database setup
packages/docs/                    // This documentation site
```

## Code Quality

Pre-commit hooks (Husky + lint-staged) run automatically on every commit to ensure linting and formatting standards are met.

- **ESLint** — zero warnings allowed (`--max-warnings=0`). Run `npm run lint` to check or `npm run lint:fix` to auto-fix.
- **Prettier** — consistent formatting across the whole codebase. Run `npm run format` to apply.

## Commit Convention

Commits reference the GitHub issue they belong to:

```
#42: short description of the change
```

Pull requests should include `Fixes #IssueID` in the description to auto-close the issue on merge, and carry one of the labels: `bug`, `feature`, `enhancement`, or `maintenance`.

## CI / Releases

GitHub Actions runs on every pull request:

1. ESLint
2. Tests
3. Cross-platform builds (Linux + Windows)

Release builds produce distribution packages for both platforms:

- **Linux** — AppImage, DEB, RPM, Snap, tar.gz
- **Windows** — NSIS installer, portable EXE, ZIP

---

BitButler is open source under the [MIT licence](https://github.com/enisz/bitbutler/blob/main/LICENSE) · [Report an issue](https://github.com/enisz/bitbutler/issues)
