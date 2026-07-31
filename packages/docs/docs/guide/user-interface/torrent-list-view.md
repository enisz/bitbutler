---
title: Torrent List View
description: A tour of the main window - toolbar, sidebar filters, search, torrent grid, and status bar.
---

# Torrent List View

The main window is where you spend most of your time in BitButler. A toolbar runs across the top, a filter sidebar sits on the left, the torrent grid fills the center, and a status bar spans the bottom.

![Torrent list view with toolbar, sidebar filters, torrent grid, and status bar](/screenshots/torrent-list-view/overview.png)

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

Right-clicking a torrent row opens a context menu with the same Start, Stop, and Force Resume actions as the toolbar - each showing its [keyboard shortcut](../keyboard-shortcuts#control) as a hint - plus [Torrent Details](./torrent-details-view), and submenus for Files, Manage, Queue, Transfer, Maintenance, Copy, and Pin Row. A Remove entry at the bottom deletes the selected torrent(s), also hinting the `Shift` modifier for the "also delete files" option.

![Torrent grid right-click context menu](/screenshots/torrent-list-view/context-menu.png)

## Sidebar Filters

The sidebar breaks the torrent list down into five filter groups, each showing a count next to every entry:

- **Status** - All, Downloading, Completed, Active, Inactive, Stopped, Checking, Errored. These are derived groupings of qBittorrent's underlying torrent states, not raw state names.
- **Trackers** - one entry per unique tracker host across your torrents, plus an entry for torrents with no tracker.
- **Categories** - one entry per category, with a **Manage** shortcut straight to [Manage > Categories](./manage/categories).
- **Tags** - one entry per tag, with a **Manage** shortcut straight to [Manage > Tags](./manage/tags).
- **Save Paths** - one entry per distinct save path in use.

Trackers, Categories, Tags, and Save Paths each have their own filter box to search long lists. Selecting an entry filters the grid to just that value; only one selection per group is active at a time. Once any filter is active anywhere in the sidebar, a **Clear All** button appears beneath the groups to reset every filter at once.

## Status Bar

A bar along the bottom of the window shows live connection and transfer information: connection status, DHT node count, share ratio, global downloaded/uploaded totals, current download/upload speed (with any active speed limit shown underneath), free disk space, how many torrents are selected out of how many are currently visible, and a polling indicator you can click to pause or resume background polling. An alternative speed limits toggle sits to the left of these widgets. See [BitButler Settings > Status Bar](./settings/bitbutler-settings#status-bar) to choose which widgets are shown and in what order.
