---
title: 'Torrent Grid Settings'
order: 3
---

# Torrent Grid Settings

Open **Settings → Torrent Grid** to configure which columns appear in the grid, their order,
and how the grid behaves.

<!-- screenshot: settings-torrent-grid -->

![Torrent grid settings tab](./screenshots/settings-torrent-grid.png)

> **Callouts:**
>
> 1. **Column selector** — multi-select dropdown to choose which columns are visible
> 2. **Column order list** — drag rows to reorder columns in the grid
> 3. **Pagination toggle** — switch between infinite scroll and paginated view
> 4. **Animate rows toggle** — enable/disable row animations on data updates
> 5. **Row double-click action** — what happens when you double-click a torrent row

## Columns

### Choosing columns

Open the **column selector** dropdown and check the columns you want to show. Uncheck any you
want to hide. The grid updates as soon as you save.

### Reordering columns

In the **column order list**, drag a row up or down to change where that column appears in the grid.

### Available columns

| Column         | Default | Description               |
| -------------- | ------- | ------------------------- |
| Name           | ✓       | Torrent name              |
| Progress       | ✓       | Download progress bar     |
| Size           | ✓       | Total size                |
| Downloaded     | ✓       | Bytes downloaded          |
| Uploaded       | ✓       | Bytes uploaded            |
| Download speed | ✓       | Current download rate     |
| Upload speed   | ✓       | Current upload rate       |
| ETA            | ✓       | Estimated completion time |
| Ratio          | ✓       | Upload/download ratio     |
| Added on       | ✓       | Date added                |
| Save path      | ✓       | Download location         |
| Category       | —       | qBittorrent category      |
| Tags           | —       | Assigned tags             |
| Seeds          | —       | Seeder count              |
| Peers          | —       | Peer count                |
| State          | —       | Raw qBittorrent state     |
| Hash           | —       | Torrent info hash         |

## Pagination

| Setting       | Behavior                                                           |
| ------------- | ------------------------------------------------------------------ |
| Off (default) | The grid shows all torrents in one scrollable list                 |
| On            | Torrents are split into pages; page controls appear below the grid |

## Animate rows

When enabled, rows in the grid animate when they are updated (e.g. progress changes). Disabling
this can improve performance if you have a large number of torrents.

## Row double-click action

Controls what happens when you double-click a torrent row:

| Option    | Behavior                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Details   | Opens the torrent details panel                                                                                             |
| Save path | Opens the torrent's save directory in your local file manager (requires a [path mapping](./server) if the server is remote) |
| None      | Double-click does nothing                                                                                                   |
