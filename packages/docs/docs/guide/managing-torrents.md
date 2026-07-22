---
title: Managing Torrents
description: Add, pause, resume, and organize torrents from the main window.
---

# Managing Torrents

Once connected to a server, the [Torrent List View](./user-interface/torrent-list-view) is where you add new torrents and control the ones already there.

## Adding Torrents

Click **Add** in the toolbar to open the Add Torrent dialog. A **General** tab covers the input itself; **Options** and **Limits** tabs (not covered here) hold further per-torrent settings, and a **Files** tab lets you pick which files to download and their priority - it's only available when a `.torrent` file with a known file list is loaded, since a magnet link has no file list until its metadata is fetched after adding.

![Torrent grid placeholder](https://placehold.co/600x400/31343C/EEE?text=Torrent+Grid)

### From a File

Click **Browse** to pick a `.torrent` file (or drop one directly onto the field). Once selected, BitButler shows the torrent's total size next to the free space available at the destination. Optionally rename it, then set a save path, category, and tags before clicking **Add**.

### From a Magnet Link

Switch the input mode to **Link** and paste one or more magnet links into the text area, one per line. As with a file, you can set a save path, category, and tags before adding - the Files tab stays disabled until the torrent's metadata has actually been fetched from its peers.

## Pausing and Resuming

Select one or more torrents and use the toolbar's **Start** and **Stop** buttons to resume or pause them, or **Start All** / **Stop All** to act on every torrent regardless of selection. See [Torrent List View > Toolbar](./user-interface/torrent-list-view#toolbar) for the rest of the toolbar's actions.

## Categories and Tags

To organize torrents by category or tag, see [Manage Categories](./user-interface/manage/categories) and [Manage Tags](./user-interface/manage/tags).
