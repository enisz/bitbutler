---
title: Add Torrent Window
description: Detailed guide to the Add Torrent window interface and its various tabs.
---

# Add Torrent Window

The Add Torrent dialog allows you to add new torrents to your qBittorrent server. It consists of multiple tabs that provide different levels of control over your torrent additions.

## General Tab

![Add Torrent dialog - General tab with file input](/screenshots/add-torrent-dialog/add-torrent-general-file.png)

The **General** tab is where you specify what you want to add - either a `.torrent` file, a folder, or magnet links.

### Adding from a Folder

![Add Torrent dialog - General tab with folder input](/screenshots/add-torrent-dialog/add-torrent-general-folder.png)

You can also add torrents directly from a folder by selecting the "Folder" option in the input mode. This scans the selected directory for `.torrent` files and lists them in a grid; enable the **Recursive** toggle (off by default) to also scan its subdirectories. Files that match a torrent already on the server are marked **Exists** and excluded from selection - only checked rows are added when you click **Add**.

### Adding from a File

Click **Browse** to pick a `.torrent` file (or drop one directly onto the field). Once selected, BitButler shows the torrent's total size next to the free space available at the destination. Optionally rename it, then set a save path, category, and tags before clicking **Add**.

### Adding from a Magnet Link

![Add Torrent dialog - General tab with magnet link input](/screenshots/add-torrent-dialog/add-torrent-general-link.png)

Switch the input mode to **Link** and paste one or more magnet links into the text area, one per line. As with a file, you can set a save path, category, and tags before adding - the Files tab is not available for magnet links, since a magnet link has no file list until its metadata is fetched after adding.

## Files Tab

![Add Torrent dialog - Files tab](/screenshots/add-torrent-dialog/add-torrent-files.png)

The **Files** tab becomes available only when a single `.torrent` file has been loaded, and shows a tree view of the files contained in that torrent. You can select or deselect individual files to download, as well as set their priority. It's unavailable for magnet links and for folder-mode (multi-torrent) additions.

## Options Tab

![Add Torrent dialog - Options tab](/screenshots/add-torrent-dialog/add-torrent-options.png)

The **Options** tab lets you configure per-torrent behavior. Each setting is remembered as the dialog's default for the next torrent you add.

- **Root Folder** - controls how a multi-file torrent's top-level folder is handled: **Default (unset)** leaves it up to qBittorrent's own global setting, **Create root folder** always wraps the files in one, and **Do not create root folder** downloads them flat.
- **Skip hash checking** - trusts data already on disk at the save path instead of having qBittorrent re-verify it before starting.
- **Add torrents in the paused state** - queues the torrent without starting it immediately.
- **Use Auto TMM** - turns on Automatic Torrent Management, so qBittorrent derives the save path from the torrent's category rather than the path set on the General tab (which is still sent, but only honored when this is off).
- **Enable sequential download** - downloads pieces in file order instead of qBittorrent's default rarest-first strategy.
- **Prioritize download first last piece** - fetches each file's first and last pieces ahead of the rest, independently of sequential download.

## Limits Tab

![Add Torrent dialog - Limits tab](/screenshots/add-torrent-dialog/add-torrent-limits.png)

The **Limits** tab lets you set transfer rate limits (download/upload speed) and share limits (ratio and seeding time) for the torrent.
