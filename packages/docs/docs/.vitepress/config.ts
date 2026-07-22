import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'BitButler Docs',
  description: 'User guide for BitButler, a remote qBittorrent-nox desktop client.',
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/bitbutler-logo.png' }]],
  themeConfig: {
    logo: '/bitbutler-logo.png',
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
            { text: 'Torrent Details View', link: '/guide/user-interface/torrent-details-view' },
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
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/enisz/bitbutler' }],
    editLink: {
      pattern: 'https://github.com/enisz/bitbutler/edit/main/packages/docs/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
