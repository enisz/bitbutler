---
title: Torrent Exists Window
description: Details about the Torrent Exists dialog that appears when adding duplicate torrents.
---

# Torrent Exists Window

![Torrent Exists dialog](/screenshots/torrent-exists/torrent-exists.png)

When you attempt to add a torrent that already exists on the qBittorrent server, BitButler displays the Torrent Exists dialog instead of allowing the duplicate addition.

This dialog shows information about the existing torrent including:

- Progress percentage
- Total size, downloaded, and uploaded
- Ratio, download speed, and upload speed
- Seeds/leechers
- Added date
- Save path
- Category and tags (if set)

If [Delete torrent files when the torrent already exists in the list](./settings/bitbutler-settings#torrent-handling) is enabled in BitButler settings and the source `.torrent` file is known, BitButler automatically deletes it from disk as soon as this dialog opens. If the deletion fails, a toast notification reports the error.

## Options

From this dialog you can:

- **Open Details** - Jump directly to the details view of the existing torrent
- **Close** - Close the dialog and take no action
