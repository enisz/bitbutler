---
title: Torrent Details View
description: The Torrent Details dialog - General, Trackers, Peers, and Content tabs, plus its footer actions.
---

# Torrent Details View

The Torrent Details dialog gives you a full, tabbed breakdown of a single torrent: its metadata and transfer stats, its trackers, its connected peers, and its file contents.

## Opening Torrent Details

Double-clicking a torrent row opens this dialog by default - see [Row double-click behavior](./settings/bitbutler-settings#grid-options) to change or disable that. You can also right-click a single torrent row and choose **Torrent Details** from the context menu (this option isn't available when multiple rows are selected). See [Torrent List View > Context Menu](./torrent-list-view#context-menu) for a look at that menu.

## General

![General tab](/screenshots/torrent-details-view/general.png)

The General tab is split into three groups:

- **General** - name, save path, remote (server-side) path, local path (only shown if a [path mapping](./settings/bitbutler-settings#path-mappings) resolves one), Automatic Torrent Management and Force Start flags, current progress, state, and any error message.
- **Transfer** - time active, ETA, connections, downloaded/uploaded totals, seeds/peers (connected vs. total known), download/upload speed and limits, wasted data, share ratio, time to next reannounce, last seen complete, ratio and seeding time limits, and the sequential download / first-last-piece-priority / super seeding flags.
- **Information** - total size, piece count (with how many you have), created-by and creation date, added-on and completed-on dates, both v1 and v2 info hashes, and the torrent's comment.

Most text fields have a small copy-to-clipboard button next to them.

## Trackers

![Trackers tab](/screenshots/torrent-details-view/trackers.png)

A sortable, filterable table of every tracker on the torrent: tier, URL, status (Disabled, Not Contacted, Working, Updating, or Not Working), and its peer/seed/leech/download counts, plus any status message from the tracker. Right-click a row to copy its URL, its cell value, or the whole row as JSON. Column order, width, and sort are remembered between sessions.

## Peers

![Peers tab](/screenshots/torrent-details-view/peers.png)

A sortable, filterable table of every peer currently connected for this torrent: country, IP and port, connection type, protocol flags (hover a flag for what it means), client name, per-peer progress, download/upload speed, downloaded/uploaded totals, relevance, and which files that peer has. Right-click a row to copy its IP:port, its cell value, or the row as JSON.

## Content

![Content tab](/screenshots/torrent-details-view/content.png)

An expandable file tree for the torrent's contents. Each file has a checkbox to include or exclude it from the download and a priority dropdown (Normal, High, or Maximum, in addition to excluded/skipped) alongside its own progress bar. Editing switches the tab into edit mode - shown by a small asterisk on the Content tab - until you save the changes.

## Footer Actions

![Footer actions](/screenshots/torrent-details-view/footer-actions.png)

A standalone **Delete** button removes the torrent. The rest of the footer groups related actions into dropdowns:

- **Control** - Resume, Pause, Force Resume.
- **Files** - Show File / Open Destination (disabled until a [path mapping](./settings/bitbutler-settings#path-mappings) resolves a local folder), Set Save Path, Set Download Path, and Export Torrent File.
- **Manage** - Rename, Change Category, Change Tags.
- **Transfer** - Transfer Limits, Share Limits, and toggles for Super Seeding, Sequential Download, and First/Last Piece Priority.
- **Maintenance** - Force Recheck, Force Reannounce, and a toggle for Automatic Torrent Management.

A **Close** button on the far right closes the dialog.
