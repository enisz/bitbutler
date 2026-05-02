---
title: 'Features'
order: 2
slug: 'features'
---

# Features

A detailed look at what BitButler can do.

## Server Management

**Multiple servers**

Add and switch between any number of qBittorrent-nox instances. Each server stores its host, port, and credentials independently.

**Encrypted credentials**

Passwords are stored using Electron's safeStorage API, which encrypts them with the OS keychain — they are never saved in plain text.

**Quick connect**

The active server is remembered between sessions so the app reconnects automatically on launch.

## Torrent Management

**Add torrents**

Add torrents by dropping .torrent files onto the app window, using the file picker, or pasting a magnet link. The add-torrent dialog lets you choose save location, category, tags, and other options before starting.

**Delete torrents**

Remove one or more selected torrents, with an option to also delete the downloaded files from disk.

**Rename**

Rename a torrent directly from the context menu.

**Move download location**

Relocate a torrent's save path without re-downloading.

**Set category & tags**

Assign or change a torrent's category and tags. Existing categories and tags from the connected server are presented as suggestions.

**Share limits**

Configure per-torrent share ratio and seeding time limits to control seeding behaviour.

**Transfer limits**

Set per-torrent upload and download speed limits independently of global limits.

**Priority & queue control**

Pause, resume, force-start, and recheck individual torrents or entire selections.

## Torrent Details

**General tab**

Shows transfer stats, save path, creation date, comment, and hash for the selected torrent.

**Content tab**

Displays the file tree of a torrent with per-file progress and priority controls.

**Peers tab**

Lists connected peers with country flag, IP, client, progress, and transfer speeds.

**Trackers tab**

Shows tracker URLs, status, and peer counts reported by each tracker.

## Real-time Sync

**Maindata streaming**

BitButler streams the qBittorrent maindata endpoint from the Electron main process and applies incremental diffs to the local torrent store — the torrent list stays up to date without polling lag.

**Transfer info**

Global download/upload speeds and free disk space are updated continuously and shown in the status bar.

## User Interface

**Torrent grid**

The main view is a feature-rich ag-Grid table. Columns can be reordered, resized, and toggled. The layout is persisted between sessions.

**Filtering**

Filter torrents by name, category, tag, status, date added, or completion date using the filter bar.

**Context menu**

Right-click any torrent row for a context menu with all common actions.

**Themes**

8 built-in colour themes covering light and dark modes. The active theme is persisted in settings.

**Localisation**

UI labels are fully translatable. English (en-US) and Hungarian (hu) are included out of the box.

**Status bar**

A configurable status bar at the bottom shows global transfer speeds, free disk space, and other stats. Each field can be toggled individually.

## Desktop Integration

**System tray**

BitButler minimises to the system tray. The tray icon menu provides quick actions such as start all / stop all and shows the connection state.

**Desktop notifications**

Receive a native OS notification when a torrent finishes downloading.

**File association**

.torrent files can be opened with BitButler directly from the file manager.

**Auto-update**

The app checks for new releases on startup and shows an in-app banner when an update is available.

---

BitButler is open source under the [MIT licence](https://github.com/enisz/bitbutler/blob/main/LICENSE) · [Report an issue](https://github.com/enisz/bitbutler/issues)
