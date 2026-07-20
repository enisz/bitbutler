import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'BitButler Docs',
  description: 'Documentation for BitButler, a remote qBittorrent-nox desktop client.',
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/bitbutler-logo.png' }]],
  themeConfig: {
    logo: '/bitbutler-logo.png',
    nav: [{ text: 'Guide', link: '/guide/getting-started' }],
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
            { text: 'Connecting a Server', link: '/guide/connecting-a-server' },
            { text: 'Managing Torrents', link: '/guide/managing-torrents' },
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
