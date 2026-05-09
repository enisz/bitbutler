# BitButler Documentation Site — Design Spec

**Date:** 2026-05-09  
**Status:** Approved

---

## Overview

Fill the existing Analog.js docs site (`packages/docs/`) with real end-user content. The site infrastructure is already deployed to GitHub Pages via CI — only content and one new dynamic page (Changelog) need to be added.

---

## Audience

End users only. No developer/contributor documentation. Users who downloaded the app and want to know how to use it.

---

## Navigation Structure

Task-oriented. Six top-level sections, ordered by numeric prefix for left-sidebar ordering:

```
01-getting-started/
  installation.md
  adding-your-first-server.md
  logging-in.md
  adding-your-first-torrent.md

02-managing-servers/
  index.md         ← add, edit, remove servers
  test-connection.md
  switching-servers.md

03-adding-torrents/
  index.md         ← from .torrent file
  magnet-link.md   ← from magnet link or URL
  options.md       ← save path, category, tags, sequential download, skip hash check

04-monitoring-downloads/
  main-screen.md   ← overview of the 4 UI areas (toolbar, sidebar, grid, status bar)
  torrent-grid.md  ← columns, reading progress, sorting
  filtering.md     ← sidebar status / tracker / path filters + search bar
  status-bar.md    ← what each widget shows
  actions.md       ← pause, resume, stop, delete, context menu

05-customizing/
  general.md       ← theme, language, behavior (toast position, delete .torrent, auto-update)
  server.md        ← polling intervals, path mappings
  torrent-grid.md  ← columns, pagination, animate rows, double-click action
  status-bar.md    ← widgets, left/right layout (drag-drop)

06-changelog/
  index.md         ← shell page; actual content rendered by Angular component at runtime
```

The existing placeholder folders (`01-getting-started/`, `02-lorem-ipsum/`) are replaced by this structure. The existing root-level placeholder files (`index.md`, `features.md`, `architecture.md`, `development.md`, `ipc-reference.md`) are removed — the homepage (`index.md`) is rewritten as a brief welcome page with links to the six sections.

---

## Page Template

Every content page follows this pattern:

```markdown
---
title: Page Title
order: N
---

# Page Title

Brief intro sentence.

<!-- screenshot: kebab-case-id -->

![Description of what is shown](./screenshots/kebab-case-id.png)

> **Callouts:**
>
> 1. **Element name** — what it does
> 2. **Element name** — what it does

Body prose explaining the UI area or task.

## Sub-section (if needed)

Additional screenshots follow the same pattern.
```

### Screenshot placeholder convention

- `<!-- screenshot: id -->` — grep marker; presence means the screenshot is not yet taken
- The `![alt](./screenshots/id.png)` broken image link is intentional — it visually signals a missing asset in the rendered site
- Callout descriptions are written at spec/content time, before screenshots are taken, so the content is complete even without the image
- Screenshots are added in a separate pass by replacing the broken link with a real file and removing the `<!-- screenshot: id -->` comment

### Numbered callout style

Each screenshot has a numbered list immediately below it. Numbers correspond to circled labels that will be added to the screenshot when it is taken (via an image editor or annotation tool). The list is written first so it can guide what the screenshot needs to show.

---

## Settings Reference — What Each Setting Does

This is the source of truth for the "Customizing the Interface" section. Each setting page covers all options in that tab.

### General tab

| Setting              | Location   | Effect                                                                                                                                 |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Theme family         | Appearance | Changes the color scheme (8 options: BitButler, Aurora, Mint Green, Purple Haze, Ocean Breeze, Pumpkin Spice, Deep Sea, Crimson Ember) |
| Theme mode           | Appearance | Light / Dark / System — System follows OS preference                                                                                   |
| Language             | Language   | Switches UI language (English / Hungarian)                                                                                             |
| Delete .torrent file | Behavior   | Automatically deletes the local .torrent file after it is added to qBittorrent                                                         |
| Check for updates    | Behavior   | Enables automatic update checks on startup                                                                                             |
| Toast position       | Behavior   | Corner where notification toasts appear (4 options)                                                                                    |

### Server tab

| Setting            | Location      | Effect                                                                                                |
| ------------------ | ------------- | ----------------------------------------------------------------------------------------------------- |
| Foreground polling | Polling       | How often (ms) the app fetches torrent data while the window is focused. Default: 2000ms              |
| Background polling | Polling       | How often (ms) the app fetches data while the window is in the background. Default: 5000ms            |
| Path mappings      | Path Mappings | Maps remote qBittorrent save paths to local filesystem paths (used when opening save folders locally) |

### Torrent Grid tab

| Setting          | Location | Effect                                                                                                       |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Visible columns  | Columns  | Which columns appear in the grid and in what order (drag to reorder)                                         |
| Pagination       | —        | Enables paginated view instead of infinite scroll                                                            |
| Animate rows     | —        | Enables row animations when grid data updates                                                                |
| Row double-click | —        | What happens when a row is double-clicked: open Details panel, open save path in file manager, or do nothing |

### Status Bar tab

Drag-and-drop interface with three zones: Available (unused), Left, Right.

| Widget            | Shows                                            |
| ----------------- | ------------------------------------------------ |
| connection-status | Whether the app is connected to qBittorrent      |
| nodes             | DHT node count                                   |
| ratio             | Global share ratio                               |
| global-down       | Total data downloaded this session               |
| global-up         | Total data uploaded this session                 |
| download-speed    | Current global download speed                    |
| upload-speed      | Current global upload speed                      |
| free-space        | Free disk space on the server                    |
| session-stats     | Session statistics summary                       |
| selection         | Info about currently selected torrents           |
| polling-indicator | Visual indicator showing when the app is polling |

---

## Changelog Page

**Implementation:** A dedicated Angular component (not a static markdown file) within the Analog.js docs site.

**Data source:** GitHub Releases API — `https://api.github.com/repos/enisz/bitbutler/releases` — fetched client-side at runtime on page load. This ensures the changelog always reflects the latest releases regardless of when the docs site was last built.

**Rendering:**

- Each release renders as an `h2` heading: `v1.1.1 — May 6, 2026 (3 days ago)`
  - Version and date from the API response (`tag_name`, `published_at`)
  - Elapsed time rendered using `TimeagoPipe` from `ngx-timeago` (already installed at monorepo root)
- Release body (markdown string from API) parsed to HTML using `marked` (already used in the docs app)
- Rendered HTML injected via `[innerHTML]`
- Right sidebar TOC auto-picks up all `h2` headings, giving users a version navigator

**Loading state:** A simple loading indicator while the fetch is in progress.  
**Error state:** A fallback message with a direct link to the GitHub releases page if the API call fails.

---

## Content Tone

- Direct and concise — tell users what to do, not what the app "allows" them to do
- Second person ("click the gear icon", not "the user can click")
- No marketing language
- Screenshots do the heavy lifting — prose supplements, not duplicates them

---

## Out of Scope

- Developer / contributor documentation
- Multiple languages (English only)
- Versioned docs (always-latest)
- In-app help or tooltips
- Search improvements (existing Fuse.js search covers it)
