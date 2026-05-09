---
title: 'Filtering and Searching'
order: 3
---

# Filtering and Searching

The left sidebar and the search bar let you narrow the torrent grid to exactly what you want to see.

<!-- screenshot: sidebar-filters-overview -->

![Left sidebar filters](./screenshots/sidebar-filters-overview.png)

> **Callouts:**
>
> 1. **Status filters** — filter by torrent state (All, Downloading, Completed, Active, etc.)
> 2. **Tracker filters** — filter by tracker host
> 3. **Save path filters** — filter by download location on the server

## Status filters

Click a status label to show only torrents in that state:

| Filter      | Shows                                             |
| ----------- | ------------------------------------------------- |
| All         | Every torrent                                     |
| Downloading | Torrents actively downloading                     |
| Completed   | Fully downloaded torrents                         |
| Active      | Torrents currently transferring data (up or down) |
| Inactive    | Torrents not currently transferring               |
| Stopped     | Manually stopped torrents                         |
| Checking    | Torrents being hash-checked                       |
| Errored     | Torrents in an error state                        |

The number next to each label shows how many torrents are in that state.

## Tracker filters

The tracker section lists each unique tracker hostname. Click a tracker to show only
torrents using that tracker.

## Save path filters

The save path section lists each unique download directory on the server. Click a path to show
only torrents downloading to that location.

## Search

<!-- screenshot: search-bar -->

![Search bar](./screenshots/search-bar.png)

> **Callouts:**
>
> 1. **Search input** — type to filter torrents by name in real time
> 2. **Keyboard shortcut** — press Ctrl+F (or Cmd+F on macOS) to focus the search bar

Type in the search bar to instantly filter the grid to torrents whose names contain the search term.
The status and sidebar filters remain active alongside the search — all active filters combine.

Press **Escape** to clear the search.
