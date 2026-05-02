---
title: 'IPC Reference'
order: 31
slug: 'ipc-reference'
parent: 'architecture'
---

# IPC Reference

This page documents all IPC channels exposed via `electron/preload.js`.

## qb namespace

All qBittorrent API proxies live under `window.bitbutler.qb`.

### qb.getMainData

Polls `/api/v2/sync/maindata` with an optional `rid` for incremental updates.

### qb.getTorrents

Returns the full torrent list from `/api/v2/torrents/info`.

### qb.addTorrent

Accepts a magnet URI or torrent file buffer and adds it to qBittorrent.

## server namespace

Manages server records stored in the SQLite database.

### server.list

Returns all saved servers (passwords are never exposed to the renderer).

### server.save

Creates or updates a server record. The password is encrypted using Electron's `safeStorage` before being written.

### server.delete

Removes a server record by ID.

## settings namespace

Persists user preferences as JSON blobs in the `settings` table.

### settings.get

Reads a setting by key, returning the parsed JSON value.

### settings.set

Serializes and writes a setting value by key.
