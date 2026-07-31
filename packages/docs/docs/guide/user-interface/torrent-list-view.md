---
title: Torrent List View
description: A tour of the main window - toolbar, sidebar filters, search, torrent grid, and status bar.
---

# Torrent List View

![Torrent list view with toolbar, sidebar filters, torrent grid, and status bar](/screenshots/torrent-list-view/overview.png)

The main window is where you spend most of your time in BitButler. A toolbar runs across the top, a filter sidebar sits on the left, the torrent grid fills the center, and a status bar spans the bottom.

## Toolbar

From left to right, the toolbar groups actions by what they act on:

- **Add** - opens the Add Torrent dialog.
- **Delete** - removes the selected torrent(s). Hold **Shift** while clicking to default the confirmation dialog's "also delete files" option to checked.
- **Start** / **Stop** - resumes or pauses the selected torrent(s).
- **Start All** / **Stop All** - resumes or pauses every torrent, regardless of selection.
- **Top** / **Up** / **Down** / **Bottom** - moves the selected torrent(s) within the download queue.
- **Settings** - a dropdown for **BitButler Settings** and **qBittorrent Settings**.
- **Manage** - a dropdown for **Manage > Servers**, **Manage > Tags**, and **Manage > Categories**.

Buttons that need a selection (Delete, Start, Stop, and the queue-reorder buttons) are disabled when no torrent is selected; **Start All** and **Stop All** are disabled only when the list is empty.

The search box on the right filters the grid as you type, debounced briefly to avoid filtering on every keystroke. Press **Ctrl+K** from anywhere in the window to jump to it, and the small **x** button (or **Escape** while focused) clears it.

## Context Menu

![Torrent grid right-click context menu](/screenshots/torrent-list-view/context-menu.png)

Right-clicking a torrent row opens this menu. Items with a hint on the right show their [keyboard shortcut](../keyboard-shortcuts#control).

<pre>
Start                                                  F3
Stop                                                   F4
Force Resume                                   Shift + F3
-----------------------------------------------------------
Torrent Details
-----------------------------------------------------------
Files                                                   ›
  Show in Folder / Open Destination
  Set Save Path
  Set Download Path
  Rename Files
  Export .torrent File(s)
Manage                                                  ›
  Rename Torrent
  Set Category
  Set Tags
Queue                                                   ›
  Move to Top
  Move Up
  Move Down
  Move to Bottom
Transfer                                                ›
  Transfer Limit
  Share Limit
  Enable/Disable Super Seeding
  Enable/Disable Sequential Download
  Enable/Disable First/Last Piece Priority
Maintenance                                             ›
  Force Recheck
  Force Reannounce
  Enable/Disable Auto TMM
Copy                                                    ›
  Copy Name(s)
  Copy Magnet Link(s)
  Copy Info Hash(es)
  Copy Save Path(s)
  Copy as JSON
Pin Row                                                 ›
  Pin to Top
  Pin to Bottom
  Unpin
-----------------------------------------------------------
Remove                                      (Shift +) Del
</pre>

**Single** actions only appear when exactly one row is selected; **Multi** actions work no matter how many rows are selected (including one).

| Action                                    | Menu        | Single | Multi | Description                                                                              |
| ----------------------------------------- | ----------- | :----: | :---: | ---------------------------------------------------------------------------------------- |
| Start                                     | -           |   ✓    |   ✓   | Resumes the selected torrent(s).                                                         |
| Stop                                      | -           |   ✓    |   ✓   | Pauses the selected torrent(s).                                                          |
| Force Resume                              | -           |   ✓    |   ✓   | Force-resumes the selected torrent(s), bypassing queueing limits.                        |
| [Torrent Details](./torrent-details-view) | -           |   ✓    |       | Opens the Torrent Details dialog for the row.                                            |
| Show in Folder / Open Destination         | Files       |   ✓    |       | Reveals the torrent's file, or opens its folder when it has more than one.               |
| Set Save Path                             | Files       |   ✓    |   ✓   | Changes where the selected torrent(s) save their data.                                   |
| Set Download Path                         | Files       |   ✓    |   ✓   | Changes the incomplete-download path for the selected torrent(s).                        |
| Rename Files                              | Files       |   ✓    |       | Opens the file rename dialog for the torrent.                                            |
| Export .torrent File(s)                   | Files       |   ✓    |   ✓   | Exports the selected torrent(s) as .torrent file(s).                                     |
| Rename Torrent                            | Manage      |   ✓    |       | Renames the torrent.                                                                     |
| Set Category                              | Manage      |   ✓    |   ✓   | Assigns a category to the selected torrent(s).                                           |
| Set Tags                                  | Manage      |   ✓    |   ✓   | Assigns tags to the selected torrent(s).                                                 |
| Move to Top                               | Queue       |   ✓    |   ✓   | Moves the selected torrent(s) to the top of the download queue.                          |
| Move Up                                   | Queue       |   ✓    |   ✓   | Moves the selected torrent(s) up one position.                                           |
| Move Down                                 | Queue       |   ✓    |   ✓   | Moves the selected torrent(s) down one position.                                         |
| Move to Bottom                            | Queue       |   ✓    |   ✓   | Moves the selected torrent(s) to the bottom of the queue.                                |
| Transfer Limit                            | Transfer    |   ✓    |   ✓   | Sets per-torrent upload/download speed limits.                                           |
| Share Limit                               | Transfer    |   ✓    |   ✓   | Sets ratio and seeding-time limits.                                                      |
| Enable/Disable Super Seeding              | Transfer    |   ✓    |   ✓   | Toggles super seeding.                                                                   |
| Enable/Disable Sequential Download        | Transfer    |   ✓    |   ✓   | Toggles sequential downloading.                                                          |
| Enable/Disable First/Last Piece Priority  | Transfer    |   ✓    |   ✓   | Toggles first/last piece priority.                                                       |
| Force Recheck                             | Maintenance |   ✓    |   ✓   | Rechecks the downloaded data on disk.                                                    |
| Force Reannounce                          | Maintenance |   ✓    |   ✓   | Reannounces to trackers immediately.                                                     |
| Enable/Disable Auto TMM                   | Maintenance |   ✓    |   ✓   | Toggles Automatic Torrent Management.                                                    |
| Copy Name(s)                              | Copy        |   ✓    |   ✓   | Copies the torrent name(s) to the clipboard.                                             |
| Copy Magnet Link(s)                       | Copy        |   ✓    |   ✓   | Copies the magnet link(s) to the clipboard.                                              |
| Copy Info Hash(es)                        | Copy        |   ✓    |   ✓   | Copies the info hash(es) to the clipboard.                                               |
| Copy Save Path(s)                         | Copy        |   ✓    |   ✓   | Copies the save path(s) to the clipboard.                                                |
| Copy as JSON                              | Copy        |   ✓    |   ✓   | Copies the selected torrent(s) as raw JSON.                                              |
| Pin to Top                                | Pin Row     |   ✓    |   ✓   | Pins the row to the top of the grid, ignoring sort and filters.                          |
| Pin to Bottom                             | Pin Row     |   ✓    |   ✓   | Pins the row to the bottom of the grid, ignoring sort and filters.                       |
| Unpin                                     | Pin Row     |   ✓    |   ✓   | Removes the row's pin.                                                                   |
| Remove                                    | -           |   ✓    |   ✓   | Deletes the selected torrent(s). Hold `Shift` to default "also delete files" to checked. |

## Sidebar Filters

The sidebar breaks the torrent list down into five filter groups, each showing a count next to every entry:

- **Status** - All, Downloading, Completed, Active, Inactive, Stopped, Checking, Errored. These are derived groupings of qBittorrent's underlying torrent states, not raw state names.
- **Trackers** - one entry per unique tracker host across your torrents, plus an entry for torrents with no tracker.
- **Categories** - one entry per category, with a **Manage** shortcut straight to [Manage > Categories](./manage/categories).
- **Tags** - one entry per tag, with a **Manage** shortcut straight to [Manage > Tags](./manage/tags).
- **Save Paths** - one entry per distinct save path in use.

Trackers, Categories, Tags, and Save Paths each have their own filter box to search long lists. Every group, including Status, works the same way: selecting an entry adds it to the active filter for that group, and you can select multiple entries within a group - the grid shows torrents matching any of them. Selecting an already-active entry removes it. Selections in different groups narrow the list together, so a torrent must match at least one selected entry in _every_ group that has an active selection to appear in the grid. Once any filter is active anywhere in the sidebar, a **Clear All** button appears beneath the groups to reset every filter at once.

## Status Bar

A bar along the bottom of the window shows live connection and transfer information: connection status, DHT node count, share ratio, global downloaded/uploaded totals, current download/upload speed (with any active speed limit shown underneath), free disk space, how many torrents are selected out of how many are currently visible, and a polling indicator you can click to pause or resume background polling. An alternative speed limits toggle sits to the left of these widgets. See [BitButler Settings > Status Bar](./settings/bitbutler-settings#status-bar) to choose which widgets are shown and in what order.
