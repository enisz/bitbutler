import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/bitbutler/',
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/bitbutler/bitbutler-logo-dark.svg' }]],
  themeConfig: {
    logo: { light: '/bitbutler-logo-light.svg', dark: '/bitbutler-logo-dark.svg' },
    siteTitle: 'BitButler',
    search: {
      provider: 'local',
      options: {
        locales: {
          hu: {
            translations: {
              button: {
                buttonText: 'Keresés',
                buttonAriaLabel: 'Keresés',
              },
              modal: {
                noResultsText: 'Nincs találat erre:',
                resetButtonTitle: 'Keresés törlése',
                footer: {
                  selectText: 'kiválasztás',
                  navigateText: 'navigálás',
                  closeText: 'bezárás',
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/enisz/bitbutler' }],
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'BitButler',
      description: 'User guide for BitButler, a remote qBittorrent-nox desktop client.',
      themeConfig: {
        nav: [{ text: 'User Guide', link: '/guide/getting-started' }],
        sidebar: {
          '/guide/': [
            {
              text: 'Introduction',
              items: [
                { text: 'Getting Started', link: '/guide/getting-started' },
                { text: 'Why BitButler', link: '/guide/why-bitbutler' },
              ],
            },
            {
              text: 'Usage',
              items: [
                { text: 'First Steps', link: '/guide/first-steps' },
                { text: 'Managing Torrents', link: '/guide/managing-torrents' },
              ],
            },
            {
              text: 'User Interface',
              items: [
                { text: 'Login Page', link: '/guide/user-interface/login-page' },
                { text: 'Torrent List View', link: '/guide/user-interface/torrent-list-view' },
                { text: 'Export Window', link: '/guide/user-interface/export-window' },
                { text: 'Import Window', link: '/guide/user-interface/import-window' },
                { text: 'Add Torrent Window', link: '/guide/user-interface/add-torrent-window' },
                {
                  text: 'Torrent Exists Window',
                  link: '/guide/user-interface/torrent-exists-window',
                },
                {
                  text: 'Torrent Details View',
                  link: '/guide/user-interface/torrent-details-view',
                },
                { text: 'Application Menu', link: '/guide/user-interface/application-menu' },
                {
                  text: 'Update Available Window',
                  link: '/guide/user-interface/update-available-window',
                },
                {
                  text: 'System Tray & Notifications',
                  link: '/guide/user-interface/system-tray',
                },
                {
                  text: 'Settings',
                  collapsed: false,
                  items: [
                    {
                      text: 'BitButler Settings',
                      link: '/guide/user-interface/settings/bitbutler-settings',
                    },
                    {
                      text: 'qBittorrent Settings',
                      link: '/guide/user-interface/settings/qbittorrent-settings',
                    },
                  ],
                },
                {
                  text: 'Manage',
                  collapsed: false,
                  items: [
                    { text: 'Servers', link: '/guide/user-interface/manage/servers' },
                    { text: 'Tags', link: '/guide/user-interface/manage/tags' },
                    { text: 'Categories', link: '/guide/user-interface/manage/categories' },
                  ],
                },
              ],
            },
            {
              text: 'Reference',
              items: [
                { text: 'FAQ', link: '/guide/faq' },
                { text: 'Glossary', link: '/guide/glossary' },
                { text: 'Troubleshooting', link: '/guide/troubleshooting' },
                { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
              ],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
        editLink: {
          pattern: 'https://github.com/enisz/bitbutler/edit/main/packages/docs/docs/:path',
          text: 'Edit this page on GitHub',
        },
      },
    },
    hu: {
      label: 'Magyar',
      lang: 'hu-HU',
      title: 'BitButler Dokumentáció',
      description:
        'Felhasználói kézikönyv a BitButlerhez, egy távoli qBittorrent-nox asztali klienshez.',
      themeConfig: {
        nav: [{ text: 'Felhasználói kézikönyv', link: '/hu/guide/getting-started' }],
        sidebar: {
          '/hu/guide/': [
            {
              text: 'Bevezetés',
              items: [
                { text: 'Kezdő lépések', link: '/hu/guide/getting-started' },
                { text: 'Miért a BitButler', link: '/hu/guide/why-bitbutler' },
              ],
            },
            {
              text: 'Használat',
              items: [
                { text: 'Első lépések', link: '/hu/guide/first-steps' },
                { text: 'Torrentek kezelése', link: '/hu/guide/managing-torrents' },
              ],
            },
            {
              text: 'Felhasználói felület',
              items: [
                { text: 'Bejelentkezési oldal', link: '/hu/guide/user-interface/login-page' },
                {
                  text: 'Torrentlista nézet',
                  link: '/hu/guide/user-interface/torrent-list-view',
                },
                { text: 'Exportálás ablak', link: '/hu/guide/user-interface/export-window' },
                { text: 'Importálás ablak', link: '/hu/guide/user-interface/import-window' },
                {
                  text: 'Torrent hozzáadása ablak',
                  link: '/hu/guide/user-interface/add-torrent-window',
                },
                {
                  text: 'Torrent már létezik ablak',
                  link: '/hu/guide/user-interface/torrent-exists-window',
                },
                {
                  text: 'Torrent részletek nézet',
                  link: '/hu/guide/user-interface/torrent-details-view',
                },
                { text: 'Alkalmazásmenü', link: '/hu/guide/user-interface/application-menu' },
                {
                  text: 'Frissítés elérhető ablak',
                  link: '/hu/guide/user-interface/update-available-window',
                },
                {
                  text: 'Rendszertálca és értesítések',
                  link: '/hu/guide/user-interface/system-tray',
                },
                {
                  text: 'Beállítások',
                  collapsed: false,
                  items: [
                    {
                      text: 'BitButler beállítások',
                      link: '/hu/guide/user-interface/settings/bitbutler-settings',
                    },
                    {
                      text: 'qBittorrent beállítások',
                      link: '/hu/guide/user-interface/settings/qbittorrent-settings',
                    },
                  ],
                },
                {
                  text: 'Kezelés',
                  collapsed: false,
                  items: [
                    { text: 'Szerverek', link: '/hu/guide/user-interface/manage/servers' },
                    { text: 'Címkék', link: '/hu/guide/user-interface/manage/tags' },
                    { text: 'Kategóriák', link: '/hu/guide/user-interface/manage/categories' },
                  ],
                },
              ],
            },
            {
              text: 'Referencia',
              items: [
                { text: 'GYIK', link: '/hu/guide/faq' },
                { text: 'Szószedet', link: '/hu/guide/glossary' },
                { text: 'Hibaelhárítás', link: '/hu/guide/troubleshooting' },
                { text: 'Billentyűparancsok', link: '/hu/guide/keyboard-shortcuts' },
              ],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: 'Az oldalon',
        },
        editLink: {
          pattern: 'https://github.com/enisz/bitbutler/edit/main/packages/docs/docs/:path',
          text: 'Oldal szerkesztése a GitHub-on',
        },
        lastUpdatedText: 'Utolsó frissítés',
        darkModeSwitchLabel: 'Megjelenés',
        sidebarMenuLabel: 'Menü',
        returnToTopLabel: 'Vissza a tetejére',
        langMenuLabel: 'Nyelv váltása',
        docFooter: {
          prev: 'Előző oldal',
          next: 'Következő oldal',
        },
        notFound: {
          title: 'OLDAL NEM TALÁLHATÓ',
          quote: 'A hivatkozott oldal nem létezik, vagy áthelyezésre került.',
          linkLabel: 'Ugrás a főoldalra',
          linkText: 'Vissza a főoldalra',
        },
      },
    },
  },
});
