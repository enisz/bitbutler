---
title: Keyboard Shortcuts
description: Global and torrent grid keyboard shortcuts available in the main window.
---

# Keyboard Shortcuts

These shortcuts are active in the main window. They're suppressed while typing in a text field, and while any dialog is open (except where noted).

## Global Shortcuts

| Shortcut | Action                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+K` | Focus the toolbar's search box.                                                                                           |
| `Escape` | While the search box is focused, clears it. Otherwise, closes the currently open dialog.                                  |
| `Delete` | Deletes the selected torrent(s). Hold `Shift` to default the confirmation dialog's "also delete files" option to checked. |

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
