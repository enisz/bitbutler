import { Component } from '@angular/core';

@Component({
  selector: 'bb-docs-development',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h1 class="fw-bold mb-2">Development</h1>
          <p class="text-body-secondary mb-5">
            How to set up, run, and build BitButler from source.
          </p>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Prerequisites</h2>
            <ul>
              <li><strong>Node.js</strong> — LTS release recommended.</li>
              <li><strong>npm</strong> — comes with Node.js.</li>
              <li>
                A running
                <a href="https://github.com/qbittorrent/qBittorrent" target="_blank" rel="noopener">
                  qBittorrent-nox
                </a>
                instance to connect to during development.
              </li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Getting the Source</h2>
            <div class="p-3 rounded border bg-body-tertiary font-monospace small mb-3">
              git clone https://github.com/enisz/bitbutler.git<br />
              cd bitbutler<br />
              npm install
            </div>
            <p class="text-body-secondary small">
              The repository is a monorepo. Running <code>npm install</code> at the root installs
              dependencies for all packages.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Common Commands</h2>
            <ul class="list-unstyled mb-0">
              @for (cmd of commands; track cmd.name) {
                <li class="mb-4">
                  <div class="p-2 rounded border bg-body-tertiary font-monospace small mb-1">
                    {{ cmd.name }}
                  </div>
                  <p class="text-body-secondary small mb-0">{{ cmd.description }}</p>
                </li>
              }
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Project Layout</h2>
            <div class="p-3 rounded border bg-body-tertiary font-monospace small">
              @for (entry of layout; track entry.path) {
                <div class="mb-1">
                  <span>{{ entry.path }}</span>
                  <span class="text-body-secondary ms-3">// {{ entry.note }}</span>
                </div>
              }
            </div>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Code Quality</h2>
            <p>
              Pre-commit hooks (Husky + lint-staged) run automatically on every commit to ensure
              linting and formatting standards are met.
            </p>
            <ul>
              <li>
                <strong>ESLint</strong> — zero warnings allowed (<code>--max-warnings=0</code>). Run
                <code>npm run lint</code> to check or <code>npm run lint:fix</code> to auto-fix.
              </li>
              <li>
                <strong>Prettier</strong> — consistent formatting across the whole codebase. Run
                <code>npm run format</code> to apply.
              </li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Commit Convention</h2>
            <p>Commits reference the GitHub issue they belong to:</p>
            <div class="p-2 rounded border bg-body-tertiary font-monospace small mb-2">
              #42: short description of the change
            </div>
            <p class="text-body-secondary small mb-0">
              Pull requests should include <code>Fixes #IssueID</code> in the description to
              auto-close the issue on merge, and carry one of the labels: <code>bug</code>,
              <code>feature</code>, <code>enhancement</code>, or <code>maintenance</code>.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">CI / Releases</h2>
            <p>GitHub Actions runs on every pull request:</p>
            <ol>
              <li>ESLint</li>
              <li>Tests</li>
              <li>Cross-platform builds (Linux + Windows)</li>
            </ol>
            <p>Release builds produce distribution packages for both platforms:</p>
            <ul>
              <li><strong>Linux</strong> — AppImage, DEB, RPM, Snap, tar.gz</li>
              <li><strong>Windows</strong> — NSIS installer, portable EXE, ZIP</li>
            </ul>
          </section>

          <footer class="text-center text-body-secondary small pt-4 border-top">
            <p class="mb-0">
              BitButler is open source under the
              <a
                href="https://github.com/enisz/bitbutler/blob/main/LICENSE"
                target="_blank"
                rel="noopener"
              >
                MIT licence
              </a>
              &middot;
              <a href="https://github.com/enisz/bitbutler/issues" target="_blank" rel="noopener">
                Report an issue
              </a>
            </p>
          </footer>
        </div>
      </div>
    </div>
  `,
})
export class DevelopmentPageComponent {
  readonly commands = [
    {
      name: 'npm start',
      description:
        'Starts the Angular dev server and Electron concurrently. This is the main command for day-to-day development.',
    },
    {
      name: 'npm run serve',
      description: 'Starts only the Angular dev server (without Electron).',
    },
    {
      name: 'npm run lint',
      description: 'Runs ESLint across the codebase. Zero warnings are allowed.',
    },
    {
      name: 'npm run lint:fix',
      description: 'Runs ESLint and automatically fixes any fixable issues.',
    },
    {
      name: 'npm run format',
      description: 'Runs Prettier to format all files in the codebase.',
    },
    {
      name: 'npm test',
      description: 'Runs the test suite.',
    },
    {
      name: 'npm run build',
      description: 'Produces an Angular production build.',
    },
    {
      name: 'npm run dist:linux',
      description: 'Builds distributable packages for Linux: AppImage, DEB, RPM, Snap, and tar.gz.',
    },
    {
      name: 'npm run dist:win',
      description:
        'Builds distributable packages for Windows: NSIS installer, portable EXE, and ZIP.',
    },
  ];

  readonly layout = [
    { path: 'packages/app/', note: 'Angular renderer (the UI)' },
    { path: 'packages/app/src/app/pages/', note: 'Lazy-loaded route pages' },
    { path: 'packages/app/src/app/components/', note: 'Shared UI components & modals' },
    { path: 'packages/app/src/app/services/', note: 'Business logic and state' },
    { path: 'packages/app/src/app/models/', note: 'TypeScript interfaces and types' },
    { path: 'packages/app/src/styles/themes/', note: 'SCSS theme files' },
    { path: 'packages/app/public/i18n/', note: 'Translation files (us.json, hu.json)' },
    { path: 'packages/electron/src/', note: 'Electron main process' },
    { path: 'packages/electron/src/preload.ts', note: 'IPC bridge (contextBridge)' },
    { path: 'packages/electron/src/ipc/', note: 'IPC handler modules' },
    { path: 'packages/electron/src/db.ts', note: 'SQLite database setup' },
    { path: 'packages/docs/', note: 'This documentation site' },
  ];
}
