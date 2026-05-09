---
title: 'Status Bar'
order: 4
---

# Status Bar

The status bar at the bottom of the main screen shows real-time statistics from the connected
qBittorrent server.

<!-- screenshot: status-bar-overview -->

![Status bar with widget labels](./screenshots/status-bar-overview.png)

> **Callouts:**
>
> 1. **Connection status** - green when connected, red when disconnected
> 2. **DHT nodes** - number of nodes in the DHT network
> 3. **Global ratio** - session-wide upload-to-download ratio
> 4. **Global downloaded / uploaded** - total session transfer totals
> 5. **Download speed / Upload speed** - current global transfer rates
> 6. **Free space** - available disk space on the server
> 7. **Polling indicator** - flashes when BitButler is fetching an update from qBittorrent

## Widgets

Each piece of information in the status bar is a **widget**. You can add, remove, and reposition
widgets in [Settings → Status Bar](../customizing/status-bar).

| Widget            | What it shows                                 |
| ----------------- | --------------------------------------------- |
| connection-status | Connected / disconnected indicator            |
| nodes             | DHT node count                                |
| ratio             | Global session ratio                          |
| global-down       | Total data downloaded this session            |
| global-up         | Total data uploaded this session              |
| download-speed    | Current download speed                        |
| upload-speed      | Current upload speed                          |
| free-space        | Free disk space on the server                 |
| session-stats     | Summary of session statistics                 |
| selection         | Info about currently selected torrents        |
| polling-indicator | Visual pulse when a data fetch is in progress |
