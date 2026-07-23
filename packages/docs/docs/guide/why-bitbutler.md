---
title: Why BitButler
description: What BitButler is for, and why it exists alongside qBittorrent's own Web UI.
---

# Why BitButler

qBittorrent-nox already ships its own Web UI - BitButler exists because a browser tab isn't always the best place to manage torrents. It's a dedicated desktop client: no tab to lose track of, no page reload, just an app that's always one Alt+Tab away.

## Remote Management

BitButler doesn't run torrents itself - it talks to qBittorrent-nox's Web API over the network, the same way a browser would, just from a native window instead of a page. Your qBittorrent-nox instance can live anywhere reachable over the network: a home server, a NAS, or a VPS.

## Multi-Server Support

Configure as many qBittorrent-nox connections as you have, and switch between them from the login screen or the toolbar's **Manage > Servers** dialog. Each connection keeps its own polling interval and path mappings, stored locally with passwords encrypted at rest - so switching servers doesn't mean re-entering credentials, and nothing is sent anywhere except directly to your own server.

## Cross-Platform

BitButler ships as native builds for both Windows and Linux, built on the same Electron and Angular foundation, so the app looks and behaves identically regardless of which one you run it on. See [Getting Started > Installation](./getting-started#installation) for the exact packages available per platform.
