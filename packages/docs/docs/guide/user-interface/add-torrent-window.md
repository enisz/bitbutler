---
title: Add Torrent Window
description: Detailed guide to the Add Torrent window interface and its various tabs.
---

# Add Torrent Window

The Add Torrent dialog allows you to add new torrents to your qBittorrent server. It consists of multiple tabs that provide different levels of control over your torrent additions.

## General Tab

The **General** tab is where you specify what you want to add - either a `.torrent` file, a folder, or magnet links.

![Add Torrent dialog - General tab with file input](/screenshots/add-torrent-dialog/add-torrent-general-file.png)

### Adding from a Folder

You can also add torrents directly from a folder by selecting the "Folder" option in the input mode. This scans the selected directory for `.torrent` files and lists them in a grid; enable the **Recursive** toggle (off by default) to also scan its subdirectories. Files that match a torrent already on the server are marked **Exists** and excluded from selection - only checked rows are added when you click **Add**.

![Add Torrent dialog - General tab with folder input](/screenshots/add-torrent-dialog/add-torrent-general-folder.png)

### Adding from a File

Click **Browse** to pick a `.torrent` file (or drop one directly onto the field). Once selected, BitButler shows the torrent's total size next to the free space available at the destination. Optionally rename it, then set a save path, category, and tags before clicking **Add**.

### Adding from a Magnet Link

Switch the input mode to **Link** and paste one or more magnet links into the text area, one per line. As with a file, you can set a save path, category, and tags before adding - the Files tab is not available for magnet links, since a magnet link has no file list until its metadata is fetched after adding.

![Add Torrent dialog - General tab with magnet link input](/screenshots/add-torrent-dialog/add-torrent-general-link.png)

## Files Tab

The **Files** tab becomes available only when a single `.torrent` file has been loaded, and shows a tree view of the files contained in that torrent. You can select or deselect individual files to download, as well as set their priority. It's unavailable for magnet links and for folder-mode (multi-torrent) additions.

![Add Torrent dialog - Files tab](/screenshots/add-torrent-dialog/add-torrent-files.png)

## Options Tab

The **Options** tab lets you configure per-torrent behavior: root folder handling, skip hash checking, adding in a paused state, Automatic Torrent Management, sequential download, and first/last piece priority.

![Add Torrent dialog - Options tab](/screenshots/add-torrent-dialog/add-torrent-options.png)

## Limits Tab

The **Limits** tab lets you set transfer rate limits (download/upload speed) and share limits (ratio and seeding time) for the torrent:

![Add Torrent dialog - Limits tab](/screenshots/add-torrent-dialog/add-torrent-limits.png)
