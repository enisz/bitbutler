---
title: 'Torrent Options'
order: 3
---

# Torrent Options

When you add a torrent (from a file or a link), the Add Torrent dialog opens so you can review and
configure the download before it starts.

<!-- screenshot: add-torrent-dialog -->

![Add torrent dialog](./screenshots/add-torrent-dialog.png)

> **Callouts:**
>
> 1. **Torrent name** — the name of the torrent (read-only, from the .torrent metadata)
> 2. **Save path** — the directory on the remote server where files will be saved
> 3. **Category** — an optional category label (must already exist in qBittorrent)
> 4. **Tags** — optional comma-separated tags
> 5. **Sequential download** — download pieces in order (useful for previewing media before the download completes)
> 6. **Skip hash check** — skip the integrity check on existing files (use if you already have the files)
> 7. **Add button** — sends the torrent to qBittorrent

## Save path

The save path is the directory on the **remote server** (not your local machine) where qBittorrent
will store the downloaded files. Click the folder icon to browse paths that already exist on the server,
or type a new path directly.

## Category

Assigns the torrent to a qBittorrent category. Categories must already exist in qBittorrent —
BitButler does not create new categories from this dialog.

## Tags

A comma-separated list of tags to assign to the torrent. Tags are created automatically if they
do not already exist.

## Sequential download

When enabled, qBittorrent downloads pieces from the beginning of the file to the end, rather than
in random order. Useful if you want to start watching a video before the download is complete.
Slightly less efficient for overall download speed.

## Skip hash check

When enabled, qBittorrent skips verifying the integrity of any existing files at the save path.
Use this when you already have a partial or complete copy of the files and want to avoid re-checking.
