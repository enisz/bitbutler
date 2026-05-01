import { Component } from '@angular/core';

@Component({
  selector: 'bb-docs-architecture',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h1 class="fw-bold mb-2">Architecture</h1>
          <p class="text-body-secondary mb-5">How BitButler is structured internally.</p>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Process Separation</h2>
            <p>
              BitButler is an Electron application consisting of two processes that communicate
              exclusively through IPC:
            </p>
            <ul>
              <li>
                <strong>Renderer process</strong> — the Angular UI. It has no direct access to
                Node.js APIs or the network.
              </li>
              <li>
                <strong>Main process</strong> — the Electron host. It owns the SQLite database,
                makes all HTTP calls to qBittorrent, and manages the OS window, tray, and
                notifications.
              </li>
            </ul>
            <div class="p-3 rounded border bg-body-tertiary font-monospace small">
              Angular (renderer)<br />
              &nbsp;&nbsp;→ window.bitbutler.*<br />
              &nbsp;&nbsp;&nbsp;&nbsp;→ preload.ts (contextBridge)<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ ipcMain.handle()<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ electron/ipc/*.ts
            </div>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">IPC Bridge</h2>
            <p>
              <code>preload.ts</code> is the only bridge between the two processes. It uses
              Electron's <code>contextBridge</code> to expose a typed
              <code>window.bitbutler</code> object with the following namespaces:
            </p>
            <div class="row g-3">
              @for (ns of namespaces; track ns.name) {
                <div class="col-sm-6">
                  <div class="p-3 rounded border h-100">
                    <h6 class="fw-semibold mb-1 font-monospace">{{ ns.name }}</h6>
                    <p class="text-body-secondary small mb-0">{{ ns.description }}</p>
                  </div>
                </div>
              }
            </div>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Angular State Management</h2>
            <p>
              The app is built on Angular's zoneless mode (no <code>zone.js</code>). State is
              managed with a combination of:
            </p>
            <ul>
              <li>
                <strong>Signals</strong> — the primary reactive primitive. <code>signal()</code>,
                <code>computed()</code>, and <code>effect()</code> are used for all new state.
                <code>BehaviorSubject</code> is avoided.
              </li>
              <li>
                <strong>RxJS</strong> — used for async streams such as the maindata polling loop and
                IPC event subscriptions.
              </li>
              <li>
                <strong>Command Bus</strong> — user actions are emitted as typed commands (e.g.
                <code>TORRENT_DELETE</code>) onto a central bus. Dedicated handler services
                subscribe to commands and perform the work, keeping components free of business
                logic.
              </li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Key Services</h2>
            <ul class="list-unstyled mb-0">
              @for (svc of services; track svc.name) {
                <li class="mb-3">
                  <strong class="font-monospace">{{ svc.name }}</strong>
                  <p class="text-body-secondary small mb-0">{{ svc.description }}</p>
                </li>
              }
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Pages & Routing</h2>
            <p>The app has three lazy-loaded routes:</p>
            <ul>
              <li>
                <code>/pages/login</code> — Login screen. The router navigates here on 401/403.
              </li>
              <li><code>/pages/main</code> — Main torrent grid and all torrent actions.</li>
              <li>
                <code>/pages/settings</code> — Settings with General, Servers, Status Bar, and Grid
                tabs.
              </li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Database</h2>
            <p>
              The main process holds a <strong>better-sqlite3</strong> database with two tables:
            </p>
            <ul>
              <li>
                <strong>servers</strong> — stores server records. Passwords are encrypted with
                Electron's <code>safeStorage</code> API before being written to disk.
              </li>
              <li>
                <strong>settings</strong> — stores arbitrary JSON blobs keyed by a namespace and
                key, used by all settings services.
              </li>
            </ul>
          </section>

          <section class="mb-5">
            <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">Tech Stack</h2>
            <div class="row g-2">
              @for (tech of stack; track tech.layer) {
                <div class="col-sm-6">
                  <div class="d-flex gap-2 p-2 rounded border">
                    <span class="text-body-secondary small" style="min-width:110px">{{
                      tech.layer
                    }}</span>
                    <span class="small fw-medium">{{ tech.value }}</span>
                  </div>
                </div>
              }
            </div>
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
export class ArchitecturePageComponent {
  readonly namespaces = [
    {
      name: 'window.bitbutler.qb',
      description: 'Login, logout, HTTP proxy to qBittorrent API, maindata sync stream.',
    },
    { name: 'window.bitbutler.server', description: 'CRUD operations for saved server entries.' },
    {
      name: 'window.bitbutler.settings',
      description: 'Read and write arbitrary settings blobs from the SQLite store.',
    },
    {
      name: 'window.bitbutler.window',
      description: 'Window state control, file/torrent drop events, window size.',
    },
    {
      name: 'window.bitbutler.electron',
      description: 'Platform info, external URL opener, file dialogs, update check.',
    },
    {
      name: 'window.bitbutler.notification',
      description: 'Trigger native OS desktop notifications.',
    },
    { name: 'window.bitbutler.torrent', description: 'Parse .torrent files in the main process.' },
    {
      name: 'window.bitbutler.menu',
      description: 'Subscribe to native application menu click events.',
    },
  ];

  readonly services = [
    {
      name: 'TorrentStoreService',
      description:
        'Central torrent state. Receives maindata chunks from QbPollingService and applies full_update or incremental diffs to the signal-based torrent list.',
    },
    {
      name: 'QbPollingService',
      description:
        'Drives the background sync loop. Streams the qBittorrent maindata endpoint and pushes chunks to TorrentStoreService.',
    },
    {
      name: 'ServerStoreService',
      description:
        'Tracks the currently active server. Exposes a computed() signal for the current server selection.',
    },
    {
      name: 'CommandBusService',
      description:
        'Central event bus. Components emit typed commands; handler services subscribe and execute the corresponding logic.',
    },
    {
      name: 'TorrentCommandHandlerService',
      description: 'Handles all TORRENT_* commands (delete, rename, move, tag, etc.).',
    },
    {
      name: 'UiCommandHandlerService',
      description: 'Handles UI commands such as opening modals and dialogs.',
    },
    {
      name: 'ServerCommandHandlerService',
      description: 'Handles server connect/disconnect and CRUD commands.',
    },
    {
      name: 'ThemeService',
      description: 'Applies the selected theme class to the document root at runtime.',
    },
    {
      name: 'GeneralSettingsService',
      description: 'Persists and exposes general app settings (theme, language, auto-update).',
    },
  ];

  readonly stack = [
    { layer: 'Frontend', value: 'Angular 20 (zoneless, signals)' },
    { layer: 'Desktop', value: 'Electron' },
    { layer: 'Build', value: 'Vite + @analogjs/vite-plugin-angular' },
    { layer: 'Styling', value: 'SCSS + Bootstrap 5' },
    { layer: 'Data grid', value: 'ag-Grid' },
    { layer: 'Database', value: 'SQLite (better-sqlite3)' },
    { layer: 'HTTP client', value: 'axios (main process only)' },
    { layer: 'i18n', value: '@ngx-translate' },
  ];
}
