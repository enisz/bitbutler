import { Component } from '@angular/core';

@Component({
  selector: 'bb-docs-index',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <header class="mb-5 text-center">
            <h1 class="display-4 fw-bold">BitButler</h1>
            <p class="lead text-body-secondary">
              A cross-platform desktop client for remote qBittorrent-nox instances
            </p>
            <div class="d-flex gap-3 justify-content-center mt-4">
              <a
                href="https://github.com/enisz/bitbutler/releases"
                class="btn btn-primary px-4"
                target="_blank"
                rel="noopener"
              >
                Download
              </a>
              <a
                href="https://github.com/enisz/bitbutler"
                class="btn btn-outline-secondary px-4"
                target="_blank"
                rel="noopener"
              >
                GitHub
              </a>
            </div>
          </header>

          <section class="mb-5">
            <h2 class="h4 fw-semibold mb-3">What is BitButler?</h2>
            <p>
              BitButler is an Electron desktop app for managing remote
              <a href="https://github.com/qbittorrent/qBittorrent" target="_blank" rel="noopener">
                qBittorrent-nox
              </a>
              instances. Connect to multiple servers, monitor active torrents, and control downloads
              from a clean, modern interface — all without opening a browser.
            </p>
          </section>

          <section class="mb-5">
            <h2 class="h4 fw-semibold mb-3">Getting Started</h2>
            <ol class="list-group list-group-numbered list-group-flush">
              <li class="list-group-item bg-transparent">
                <strong>Download</strong> the latest release for your platform from the
                <a href="https://github.com/enisz/bitbutler/releases" target="_blank" rel="noopener"
                  >releases page</a
                >.
              </li>
              <li class="list-group-item bg-transparent">
                <strong>Install</strong> — AppImage, DEB, or RPM on Linux; NSIS installer or
                portable on Windows.
              </li>
              <li class="list-group-item bg-transparent">
                <strong>Add a server</strong> — enter your qBittorrent-nox host, port, and
                credentials.
              </li>
              <li class="list-group-item bg-transparent">
                <strong>Connect</strong> and start managing your torrents.
              </li>
            </ol>
          </section>

          <section class="mb-5">
            <h2 class="h4 fw-semibold mb-3">Features</h2>
            <div class="row g-3">
              @for (feature of features; track feature.title) {
                <div class="col-sm-6">
                  <div class="p-3 rounded border h-100">
                    <h6 class="fw-semibold mb-1">{{ feature.title }}</h6>
                    <p class="text-body-secondary small mb-0">{{ feature.description }}</p>
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
export class IndexPageComponent {
  readonly features = [
    {
      title: 'Multi-server support',
      description: 'Connect to multiple qBittorrent-nox instances and switch between them.',
    },
    {
      title: 'Real-time sync',
      description: 'Torrent list updates via streaming maindata — no polling lag.',
    },
    {
      title: 'Torrent file & magnet links',
      description: 'Open .torrent files or paste magnet links directly from the app.',
    },
    {
      title: 'System tray',
      description: 'Minimises to tray with quick actions for start/stop all torrents.',
    },
    {
      title: 'Themes',
      description: '8 built-in colour themes with light and dark mode support.',
    },
    {
      title: 'Cross-platform',
      description: 'Available for Linux (AppImage, DEB, RPM) and Windows (installer, portable).',
    },
  ];
}
