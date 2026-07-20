# BitButler VitePress Docs App - Design

## Context

Issue #231 ("Add Analog.js documentation app") previously described a VitePress-style Angular/Analog.js app; a full implementation of that existed on a local, never-pushed branch (`231-add-analog-docs-app`) and has been deleted - it was a test run the user did not intend to keep. This design replaces that direction: build the documentation app with the actual **VitePress** package instead of an Angular-native reimplementation. Issue #231 will be reused and its description adjusted later by the user to reflect this; that adjustment is out of scope for this change.

BitButler is otherwise an all-Angular/TypeScript monorepo, but the docs app is intentionally standalone tooling (Vite + Vue, VitePress's own stack) - it does not share code or build tooling with `packages/app` or `packages/electron`, only the color palette (as values, not as shared SCSS).

## Goals

- A new npm workspace package, `@bitbutler/docs`, at `packages/docs/`, built with VitePress.
- A landing page and a placeholder guide section, using VitePress's standard layout: top bar (brand/logo, nav, local search, dark/light toggle, GitHub icon), left sidebar with grouped navigation, right-side on-page table of contents with scrollspy.
- Custom `bitbutler-light` / `bitbutler-dark` skinning of VitePress's built-in light/dark toggle, reusing the `bitbutler` theme's color palette from `packages/app`.
- Guide pages filled with lorem ipsum placeholder content and a couple of `placehold.co` test images, structured so the sidebar, scrollspy TOC, local search, edit-on-GitHub link, last-updated timestamp, and prev/next footer nav can all be exercised and visually verified.
- Root-level `serve:docs` / `build:docs` npm scripts.
- Not in scope: CI/deploy workflow (e.g. GitHub Pages), wiring into `build:ui`/Electron packaging, or real (non-placeholder) content. All follow-up work.

## Package & tooling

- New workspace member `packages/docs/` (`@bitbutler/docs`), picked up automatically by the existing `"workspaces": ["packages/*"]` entry in the root `package.json`.
- Dependencies: `vitepress` (and its `vue` peer, pulled in transitively).
- VitePress source root at `packages/docs/docs/` (VitePress convention: `.vitepress/config.ts` lives inside the source root).
- `packages/docs/package.json` scripts:
  - `"serve": "vitepress dev docs"`
  - `"build": "vitepress build docs"`
  - `"preview": "vitepress preview docs"`
- Root `package.json` additions (mirroring the existing `build:electron` / `build:ui` naming convention):
  - `"serve:docs": "npm run serve --workspace=packages/docs"`
  - `"build:docs": "npm run build --workspace=packages/docs"`

## Content structure

```
packages/docs/docs/
  .vitepress/
    config.ts
    theme/
      index.ts       # extends DefaultTheme
      style.css       # bitbutler-light/dark CSS var overrides
  public/
    bitbutler-logo.png   # copied from packages/app/src/assets/images/bitbutler-logo-bitbutler.png
  index.md               # landing page (VitePress "home" layout)
  guide/
    getting-started.md
    why-bitbutler.md
    connecting-a-server.md
    managing-torrents.md
    keyboard-shortcuts.md
```

## Landing page (`docs/index.md`)

VitePress "home" layout frontmatter (`layout: home`): hero with logo, tagline, "Get Started" action (→ `/guide/getting-started`) and "GitHub" action (→ repo), and a `features` grid (3-4 cards) summarizing BitButler: remote qBittorrent-nox control, multi-server support, cross-platform desktop app.

## Guide section

`themeConfig.sidebar` for the `/guide/` path defines two collapsible groups:

- **Introduction**: Getting Started (`getting-started.md`), Why BitButler (`why-bitbutler.md`)
- **Usage**: Connecting a Server (`connecting-a-server.md`), Managing Torrents (`managing-torrents.md`), Keyboard Shortcuts (`keyboard-shortcuts.md`)

Each page has a title (h1) and a handful of `h2`/`h3` sections filled with lorem ipsum paragraphs - enough headings per page to produce a meaningful scrollspy TOC. `connecting-a-server.md` and `managing-torrents.md` each embed one placeholder image via `https://placehold.co/600x400/EEE/31343C` (adjust size/colors per image so they're visually distinguishable).

`themeConfig.nav` has a single "Guide" top-level link pointing at `/guide/getting-started`.

All of the following are VitePress built-ins, enabled via `themeConfig` in `.vitepress/config.ts` - no custom components needed:

- Right-side on-page TOC with scrollspy (`themeConfig.outline`).
- Local search (`themeConfig.search: { provider: 'local' }`).
- Dark/light toggle (`appearance: true`, default).
- GitHub icon (`themeConfig.socialLinks: [{ icon: 'github', link: 'https://github.com/enisz/bitbutler' }]`).
- Edit-on-GitHub link (`themeConfig.editLink`, pattern `https://github.com/enisz/bitbutler/edit/main/packages/docs/docs/:path`).
- Last-updated timestamp (`lastUpdated: true` - VitePress derives this from the file's git history automatically).
- Prev/next footer nav (automatic, derived from sidebar order; can be overridden per-page via frontmatter if a page needs to opt out).

## Theming - bitbutler-light / bitbutler-dark

This is VitePress's existing light/dark toggle (`appearance: true`), reskinned - not a separate multi-theme picker menu.

`.vitepress/theme/index.ts` extends `DefaultTheme` and imports `./style.css`. `style.css` overrides VitePress's `--vp-c-*` design tokens under `:root` (light) and `.dark` (dark), sourced from the exact values in `packages/app/src/styles/themes/bitbutler/_light.scss` / `_dark.scss`:

| Token         | Light     | Dark      |
| ------------- | --------- | --------- |
| bg            | `#f5ede3` | `#121213` |
| surface       | `#f0e6d8` | `#1c1c1e` |
| text          | `#2f2f33` | `#e5d6c1` |
| border        | `#d7d2cb` | `#2d2d2f` |
| primary/brand | `#4a4a4f` | `#e4d7c5` |
| accent        | `#c7a57a` | `#e1b985` |
| success       | `#4aae70` | `#7ecf95` |
| danger        | `#d9534f` | `#e06c67` |
| warning       | `#f0ad4e` | `#f4c46b` |
| info          | `#5bc0de` | `#78d0e4` |

Mapped onto VitePress's token set (`--vp-c-bg`, `--vp-c-bg-alt`, `--vp-c-text-1`, `--vp-c-divider`, `--vp-c-brand-1`, etc. plus the `--vp-c-brand-*` hover/active variants VitePress derives shades for).

The BitButler logo (`bitbutler-logo-bitbutler.png`, copied into `docs/public/`) is used as both the nav logo and the site favicon.

## Repo integration

- `.gitignore`: add `packages/docs/docs/.vitepress/dist` and `packages/docs/docs/.vitepress/cache`.
- `.eslintrc.json`: add an override block for `packages/docs/docs/.vitepress/**/*.ts` (the config/theme TypeScript files), matching the existing override style (prettier + reasonable TS parser options, no Angular-specific plugins since this isn't Angular code).
- Root `lint` script: extend the glob to include `packages/docs/docs/.vitepress/**/*.ts`.
- `CLAUDE.md`: add a row for `@bitbutler/docs` in the "Monorepo structure" table, and document the `serve:docs`/`build:docs` root scripts in the Commands section.

## Verification

- `npm run serve:docs` (and `npm run serve --workspace=packages/docs`) renders `/`, `/guide/getting-started`, and the other four guide pages.
- Dark/light toggle switches and visually matches the bitbutler palette in both modes.
- Sidebar shows the two collapsible groups with the current page highlighted; right-side TOC scrollspy highlights the heading in view while scrolling.
- Local search returns results across the placeholder guide content.
- Each guide page footer shows a working "Edit this page on GitHub" link, a last-updated timestamp, and prev/next links matching sidebar order.
- Placeholder images load from `placehold.co` in both light and dark mode.
- `npm run build:docs` succeeds.
- `npm run lint` and `npm run format` pass clean repo-wide.
