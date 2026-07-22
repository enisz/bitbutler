---
title: Keyboard Shortcuts
description: Global, menu, and torrent grid keyboard shortcuts available in BitButler.
---

# Keyboard Shortcuts

These shortcuts are active in the main window. They're suppressed while typing in a text field, and while any dialog is open (except where noted).

## Global Shortcuts

| Shortcut | Action                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+K` | Focus the toolbar's search box.                                                                                           |
| `Escape` | While the search box is focused, clears it. Otherwise, closes the currently open dialog.                                  |
| `Delete` | Deletes the selected torrent(s). Hold `Shift` to default the confirmation dialog's "also delete files" option to checked. |

## Menu Shortcuts

These come from the native [Application Menu](./user-interface/application-menu) and work even when the window doesn't have focus on some platforms, since they're registered at the OS level rather than in the renderer:

| Shortcut       | Action               |
| -------------- | -------------------- |
| `Ctrl+N`       | Add Torrent          |
| `Ctrl+E`       | Export Torrents      |
| `Ctrl+I`       | Import Torrents      |
| `Ctrl+L`       | Disconnect           |
| `Ctrl+Q`       | Quit                 |
| `Ctrl+.`       | BitButler Settings   |
| `Ctrl+,`       | qBittorrent Settings |
| `Ctrl+Shift+S` | Manage Servers       |
| `Ctrl+Shift+T` | Manage Tags          |
| `Ctrl+Shift+C` | Manage Categories    |
| `Ctrl+U`       | Check for Updates    |
| `F1`           | About                |

All of these except Quit and About require being connected to a server. See [Application Menu](./user-interface/application-menu) for the full menu structure these belong to.

## Grid Shortcuts

The rest apply to the torrent grid itself, and are disabled while any dialog is open.

### Selection

| Shortcut                      | Action                                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| `Ctrl+A`                      | Selects every torrent currently visible (respecting active filters).     |
| `Shift` + navigation key      | Extends the current selection from the anchor row to the new position.   |
| `Shift+Ctrl` + navigation key | Extends the selection without clearing rows selected outside that range. |

### Navigation

| Shortcut                  | Action                                     |
| ------------------------- | ------------------------------------------ |
| `Arrow Up` / `Arrow Down` | Moves focus to the row above or below.     |
| `Home` / `End`            | Jumps to the first or last row.            |
| `Page Up` / `Page Down`   | Moves focus by roughly one screen of rows. |

Moving focus without `Shift` also replaces the current selection with just the newly focused row, unless `Ctrl` is held, in which case focus moves without changing the selection at all. Double-clicking a cell that supports inline editing, and the `Enter`/`Escape` keys to confirm or cancel it, follow the underlying grid library's standard editing behavior rather than anything BitButler customizes.
