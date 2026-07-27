---
title: Managing Torrents
description: Add, pause, resume, and organize torrents from the main window.
---

# Managing Torrents

Once connected to a server, the [Torrent List View](./user-interface/torrent-list-view) is where you add new torrents and control the ones already there.

## Adding Torrents

Click **Add** in the toolbar to open the [Add Torrent window](./user-interface/add-torrent-window). This dialog provides a comprehensive interface for adding new torrents with various options.

### From a File

Click **Browse** to pick a `.torrent` file (or drop one directly onto the field). Once selected, BitButler shows the torrent's total size next to the free space available at the destination. Optionally rename it, then set a save path, category, and tags before clicking **Add**.

### From a Folder

You can also add torrents directly from a folder by selecting the "Folder" option in the input mode. This scans the selected directory for `.torrent` files; enable **Recursive** (off by default) to also scan its subdirectories. Files that already exist on the server are marked and excluded from selection - see the [Add Torrent window](./user-interface/add-torrent-window#adding-from-a-folder) for details.

### From a Magnet Link

Switch the input mode to **Link** and paste one or more magnet links into the text area, one per line. As with a file, you can set a save path, category, and tags before adding - the Files tab stays disabled until the torrent's metadata has actually been fetched from its peers.

## Pausing and Resuming

Select one or more torrents and use the toolbar's **Start** and **Stop** buttons to resume or pause them, or **Start All** / **Stop All** to act on every torrent regardless of selection. See [Torrent List View > Toolbar](./user-interface/torrent-list-view#toolbar) for the rest of the toolbar's actions.

## Duplicate Torrents

If you try to add a torrent that's already on the server, BitButler shows the [Torrent Exists window](./user-interface/torrent-exists-window) instead: the existing torrent's progress, size, ratio, seeds/peers, added date, save path, and category/tags (if set). From here you can jump straight to it with **Open Details**, or close the dialog. If "Delete torrent files after adding them to the list" is enabled (see [BitButler Settings > Behavior](./user-interface/settings/bitbutler-settings#behavior)) and the source `.torrent` file is known, a **Delete** button also appears to remove that now-redundant file from disk. This applies to file and magnet-link additions; in folder mode, duplicates are instead flagged directly in the folder grid rather than opening this dialog.

## Renaming a Torrent

Right-click a single torrent and choose **Manage > Rename Torrent** (multi-selection doesn't offer this). The dialog shows the current name in an editable field; **Save** stays disabled until you actually change it. Renaming updates the torrent's display name, and - where possible - the underlying file or root folder on disk to match: a single-file torrent gets its file renamed, a multi-file torrent gets its root folder renamed.

## Setting Category and Tags for a Selection

Right-click one or more torrents and choose **Manage > Set Category** or **Manage > Set Tags** to assign them to everything currently selected at once - the dialog's header shows either the single torrent's name or a "N torrents selected" count. Both dialogs let you type a category or tag name that doesn't exist yet and create it on the spot, without leaving the dialog. This is a per-selection shortcut, distinct from the admin-focused [Manage > Categories](./user-interface/manage/categories) and [Manage > Tags](./user-interface/manage/tags) dialogs, which manage the full list rather than one selection's assignment.

## Deleting a Torrent

Click **Delete** in the toolbar (or use the grid's own delete action) to open a confirmation dialog listing how many torrents are about to be removed. A checkbox - unchecked by default, or pre-checked if you held **Shift** when triggering delete - controls whether the underlying files are also removed from disk; checking it shows exactly how much disk space will be freed. Confirming removes the torrent(s) from qBittorrent (and their files, if that box was checked); canceling leaves everything untouched.

## Categories and Tags

To organize torrents by category or tag, see [Manage Categories](./user-interface/manage/categories) and [Manage Tags](./user-interface/manage/tags).
