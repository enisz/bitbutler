import { Component } from '@angular/core';

@Component({
  selector: 'bb-docs-features',
  template: `
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h1 class="fw-bold mb-2">Features</h1>
          <p class="text-body-secondary mb-5">A detailed look at what BitButler can do.</p>

          @for (section of sections; track section.title) {
            <section class="mb-5">
              <h2 class="h5 fw-semibold mb-3 border-bottom pb-2">{{ section.title }}</h2>
              <ul class="list-unstyled mb-0">
                @for (item of section.items; track item.name) {
                  <li class="mb-3">
                    <strong>{{ item.name }}</strong>
                    <p class="text-body-secondary small mb-0">{{ item.description }}</p>
                  </li>
                }
              </ul>
            </section>
          }

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
export class FeaturesPageComponent {
  readonly sections = [
    {
      title: 'Server Management',
      items: [
        {
          name: 'Multiple servers',
          description:
            'Add and switch between any number of qBittorrent-nox instances. Each server stores its host, port, and credentials independently.',
        },
        {
          name: 'Encrypted credentials',
          description:
            "Passwords are stored using Electron's safeStorage API, which encrypts them with the OS keychain — they are never saved in plain text.",
        },
        {
          name: 'Quick connect',
          description:
            'The active server is remembered between sessions so the app reconnects automatically on launch.',
        },
      ],
    },
    {
      title: 'Torrent Management',
      items: [
        {
          name: 'Add torrents',
          description:
            'Add torrents by dropping .torrent files onto the app window, using the file picker, or pasting a magnet link. The add-torrent dialog lets you choose save location, category, tags, and other options before starting.',
        },
        {
          name: 'Delete torrents',
          description:
            'Remove one or more selected torrents, with an option to also delete the downloaded files from disk.',
        },
        {
          name: 'Rename',
          description: 'Rename a torrent directly from the context menu.',
        },
        {
          name: 'Move download location',
          description: "Relocate a torrent's save path without re-downloading.",
        },
        {
          name: 'Set category & tags',
          description:
            "Assign or change a torrent's category and tags. Existing categories and tags from the connected server are presented as suggestions.",
        },
        {
          name: 'Share limits',
          description:
            'Configure per-torrent share ratio and seeding time limits to control seeding behaviour.',
        },
        {
          name: 'Transfer limits',
          description:
            'Set per-torrent upload and download speed limits independently of global limits.',
        },
        {
          name: 'Priority & queue control',
          description:
            'Pause, resume, force-start, and recheck individual torrents or entire selections.',
        },
      ],
    },
    {
      title: 'Torrent Details',
      items: [
        {
          name: 'General tab',
          description:
            'Shows transfer stats, save path, creation date, comment, and hash for the selected torrent.',
        },
        {
          name: 'Content tab',
          description:
            'Displays the file tree of a torrent with per-file progress and priority controls.',
        },
        {
          name: 'Peers tab',
          description:
            'Lists connected peers with country flag, IP, client, progress, and transfer speeds.',
        },
        {
          name: 'Trackers tab',
          description: 'Shows tracker URLs, status, and peer counts reported by each tracker.',
        },
      ],
    },
    {
      title: 'Real-time Sync',
      items: [
        {
          name: 'Maindata streaming',
          description:
            'BitButler streams the qBittorrent maindata endpoint from the Electron main process and applies incremental diffs to the local torrent store — the torrent list stays up to date without polling lag.',
        },
        {
          name: 'Transfer info',
          description:
            'Global download/upload speeds and free disk space are updated continuously and shown in the status bar.',
        },
      ],
    },
    {
      title: 'User Interface',
      items: [
        {
          name: 'Torrent grid',
          description:
            'The main view is a feature-rich ag-Grid table. Columns can be reordered, resized, and toggled. The layout is persisted between sessions.',
        },
        {
          name: 'Filtering',
          description:
            'Filter torrents by name, category, tag, status, date added, or completion date using the filter bar.',
        },
        {
          name: 'Context menu',
          description: 'Right-click any torrent row for a context menu with all common actions.',
        },
        {
          name: 'Themes',
          description:
            '8 built-in colour themes covering light and dark modes. The active theme is persisted in settings.',
        },
        {
          name: 'Localisation',
          description:
            'UI labels are fully translatable. English (en-US) and Hungarian (hu) are included out of the box.',
        },
        {
          name: 'Status bar',
          description:
            'A configurable status bar at the bottom shows global transfer speeds, free disk space, and other stats. Each field can be toggled individually.',
        },
      ],
    },
    {
      title: 'Desktop Integration',
      items: [
        {
          name: 'System tray',
          description:
            'BitButler minimises to the system tray. The tray icon menu provides quick actions such as start all / stop all and shows the connection state.',
        },
        {
          name: 'Desktop notifications',
          description: 'Receive a native OS notification when a torrent finishes downloading.',
        },
        {
          name: 'File association',
          description:
            '.torrent files can be opened with BitButler directly from the file manager.',
        },
        {
          name: 'Auto-update',
          description:
            'The app checks for new releases on startup and shows an in-app banner when an update is available.',
        },
      ],
    },
  ];
}
