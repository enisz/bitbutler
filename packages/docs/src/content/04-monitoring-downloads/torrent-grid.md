---
title: 'Torrent Grid'
order: 2
---

# Torrent Grid

The torrent grid lists all torrents on the server. Columns are sortable, resizable, and fully
configurable.

<!-- screenshot: torrent-grid-columns -->

![Torrent grid with column labels](./screenshots/torrent-grid-columns.png)

> **Callouts:**
>
> 1. **Name** - the torrent name; click to sort alphabetically
> 2. **Progress bar** - visual download progress
> 3. **Size** - total size of the torrent
> 4. **Download speed / Upload speed** - current transfer rates
> 5. **ETA** - estimated time to completion
> 6. **Ratio** - upload-to-download ratio

## Available columns

The default view shows a curated set of columns. Many more are available - add or remove them in
[Settings → Torrent Grid](../customizing/torrent-grid).

| Column         | Shows                               |
| -------------- | ----------------------------------- |
| Name           | Torrent name                        |
| Progress       | Download progress (visual bar)      |
| Size           | Total size                          |
| Downloaded     | Bytes downloaded so far             |
| Uploaded       | Bytes uploaded so far               |
| Download speed | Current download rate               |
| Upload speed   | Current upload rate                 |
| ETA            | Estimated completion time           |
| Ratio          | Share ratio (uploaded ÷ downloaded) |
| Added on       | Date the torrent was added          |
| Save path      | Download location on the server     |
| Category       | qBittorrent category                |
| Tags           | Assigned tags                       |
| Seeds          | Number of seeders                   |
| Peers          | Number of peers                     |
| State          | Raw qBittorrent state code          |
| Hash           | Torrent info hash                   |

## Sorting

Click any column header to sort by that column. Click again to reverse the sort order.

## Row double-click

Double-clicking a torrent row opens a configurable action. You can set it to open the
Details panel, open the save path in your file manager, or do nothing. Change this in
[Settings → Torrent Grid](../customizing/torrent-grid).

## Pinned torrents

Right-click a torrent and choose **Pin to top** or **Pin to bottom** to keep it visible
regardless of the current sort order.
