---
title: Import Window
description: Restore torrents from a BitButler export archive onto the currently connected server.
---

# Import Window

![Import window with archive info, torrents to import, and restore options](/screenshots/import-window/overview.png)

The Import Window restores torrents from a `.bbe` archive (BitButler's export format, see [Export Window](./export-window)) onto whichever server is currently connected. It always imports into the active connection - there's no destination-server picker inside the dialog, so switch servers first via [Manage > Servers](./manage/servers) if you need a different target.

## Opening the Import Window

Open it from the toolbar's native **File** menu: **File > Import Torrents** (or **Ctrl+I**), enabled only while logged in. You don't have to go through the menu, though - double-clicking a `.bbe` file, or launching BitButler with one as an argument, opens (or focuses) the app and loads that archive directly into this window.

## Archive Info

![Archive info summary](/screenshots/import-window/archive-info.png)

Once an archive is loaded, an **Archive** section summarizes it: the server it was exported from, the server you're importing to, that server's URL, the export date, the torrent count, tag and category counts (if included), and the export type - **Full export** (complete metadata, every restore option available) or **Legacy export** (built from magnet links only, so file renames and file priorities can't be restored).

## Previewing Contents

![Torrents to import grid](/screenshots/import-window/torrents-to-import.png)

A **Torrents to Import** grid lists every torrent in the archive with its save path, category, tags, speed/ratio/seeding-time limits, and qBittorrent flags (Auto TMM, Sequential Download, Super Seeding, First/Last Piece Priority), sortable and filterable per column. Each row has a checkbox: torrents already present on the destination server (matched by hash) are unchecked by default, but you can check one anyway to import it again and overwrite its settings. Unchecking any row skips it.

## Restore Options

![Restore options toggles](/screenshots/import-window/restore-options.png)

A set of toggles controls which pieces of each torrent's metadata get restored on import: save path, categories, tags, speed limits, share limits, file renames, file priorities, Auto-TMM, sequential download, super seeding, and first/last piece priority. File renames and file priorities are unavailable (and disabled) for a legacy export, since magnet links alone don't carry that information.

## Path Remapping

![Save path remapping rules](/screenshots/import-window/save-path-remapping.png)

Shown only when the **Save path** restore option is enabled. Each rule rewrites a save-path prefix from the source server's directory layout to the destination server's - useful when the two servers don't mount storage at the same paths. Rules are matched in order and the first matching prefix wins.

## Category Path Mapping

![Category path remapping rules](/screenshots/import-window/category-path-remapping.png)

Shown only when the **Categories** restore option is enabled, this works the same way as path remapping but for category save paths. An **Overwrite existing categories** switch additionally updates the save path of categories that already exist on the destination server (via qBittorrent's edit endpoint) instead of leaving them untouched; this preserves existing torrent assignments but, depending on your qBittorrent [Save Management](./settings/qbittorrent-settings#save-management) setting for category path changes, can disable Auto TMM on every torrent already assigned to that category - not just the ones being imported.

## After Import

![After import state options](/screenshots/import-window/after-import.png)

Before starting, choose what state imported torrents should start in: **Keep paused**, **Start active ones** (resume whichever were active at export time), or **Start all** immediately regardless of their previous state.

## Import Progress

Once started, a progress bar tracks torrents processed against the total, with the current torrent's name shown underneath. When it finishes, a summary reports how many were imported, already existed, were skipped, and failed - and any row that failed is highlighted in the grid. Cancel is available while the import is running.
