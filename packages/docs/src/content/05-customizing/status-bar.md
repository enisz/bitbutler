---
title: 'Status Bar Settings'
order: 4
---

# Status Bar Settings

Open **Settings → Status Bar** to choose which widgets appear in the status bar and where
they are positioned.

<!-- screenshot: settings-status-bar -->

![Status bar settings tab](./screenshots/settings-status-bar.png)

> **Callouts:**
>
> 1. **Available** — pool of widgets not currently shown in the status bar
> 2. **Left zone** — widgets displayed on the left side of the status bar
> 3. **Right zone** — widgets displayed on the right side of the status bar

## How it works

The settings panel has three drag-and-drop zones:

- **Available** — widgets that are hidden
- **Left** — widgets shown on the left side of the status bar
- **Right** — widgets shown on the right side of the status bar

Drag a widget from one zone to another to move it. The status bar updates as soon as you save.

## Available widgets

| Widget            | What it shows                                          |
| ----------------- | ------------------------------------------------------ |
| connection-status | Green/red indicator for server connectivity            |
| nodes             | Number of DHT nodes                                    |
| ratio             | Session-wide upload/download ratio                     |
| global-down       | Total data downloaded this session                     |
| global-up         | Total data uploaded this session                       |
| download-speed    | Current global download speed                          |
| upload-speed      | Current global upload speed                            |
| free-space        | Available disk space on the server                     |
| session-stats     | Summary of session statistics                          |
| selection         | Info about the currently selected torrents in the grid |
| polling-indicator | Pulses when the app is fetching data from qBittorrent  |

## Default layout

| Zone               | Widgets (left to right)                                     |
| ------------------ | ----------------------------------------------------------- |
| Left               | connection-status, nodes, ratio, global-down, global-up     |
| Right              | download-speed, upload-speed, free-space, polling-indicator |
| Available (hidden) | selection                                                   |
