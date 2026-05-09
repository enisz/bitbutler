---
title: 'Actions'
order: 5
---

# Actions

Manage torrents from the toolbar buttons and the right-click context menu.

## Toolbar actions

Select one or more torrents in the grid to reveal action buttons in the toolbar.

<!-- screenshot: toolbar-contextual-actions -->

![Toolbar with contextual action buttons visible](./screenshots/toolbar-contextual-actions.png)

> **Callouts:**
>
> 1. **Resume** - resume a paused or stopped torrent
> 2. **Pause** - pause the selected torrent(s)
> 3. **Stop** - stop the selected torrent(s) (removes from active queue)
> 4. **Resume All** - resume all torrents on the server
> 5. **Pause All** - pause all torrents on the server
> 6. **Delete** - remove the selected torrent(s); prompts whether to also delete files

## Context menu

Right-click any torrent row to open the context menu.

<!-- screenshot: torrent-context-menu -->

![Torrent context menu](./screenshots/torrent-context-menu.png)

> **Callouts:**
>
> 1. **Resume / Pause / Stop** - state controls
> 2. **Force resume** - resume even if the torrent has hit a ratio or seed-time limit
> 3. **Recheck** - trigger a hash check to verify file integrity
> 4. **Reannounce** - re-announce to all trackers immediately
> 5. **Open save path** - open the torrent's save directory in your file manager (requires [path mapping](../customizing/server) if the server is remote)
> 6. **Pin to top / Pin to bottom** - keep the torrent visible regardless of sort order
> 7. **Delete** - remove with an option to delete files

## Deleting torrents

When you delete a torrent (from the toolbar or context menu), BitButler asks whether to also
delete the downloaded files from the server. Deleting files is permanent and cannot be undone.
