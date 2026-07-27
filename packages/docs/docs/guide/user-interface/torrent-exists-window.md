---
title: Torrent Exists Window
description: Details about the Torrent Exists dialog that appears when adding duplicate torrents.
---

# Torrent Exists Window

When you attempt to add a torrent that already exists on the qBittorrent server, BitButler displays the Torrent Exists dialog instead of allowing the duplicate addition.

![Torrent Exists dialog](/screenshots/torrent-exists/torrent-exists.png)

This dialog shows information about the existing torrent including:

- Progress percentage
- Total size, downloaded, and uploaded
- Ratio, download speed, and upload speed
- Seeds/leechers
- Added date
- Save path
- Category and tags (if set)

## Options

From this dialog you can:

- **Open Details** - Jump directly to the details view of the existing torrent
- **Close** - Close the dialog and take no action
- **Delete** - Remove the source `.torrent` file from disk (appears only if enabled in BitButler settings and source is known)
