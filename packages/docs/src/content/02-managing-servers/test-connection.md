---
title: 'Testing a Connection'
order: 2
---

# Testing a Connection

Use the **Check connection** button on the login screen to verify that BitButler can reach a server
before logging in.

<!-- screenshot: check-connection-result -->

![Check connection result](./screenshots/check-connection-result.png)

> **Callouts:**
>
> 1. **Check connection button** — click to test the selected server
> 2. **Result indicator** — shows success (green) or failure (red) with a brief message

## What the check verifies

The check sends an authentication request to the qBittorrent Web UI. It confirms that:

- The host and port are reachable from your machine
- The username and password are accepted by qBittorrent

## Common failure reasons

| Symptom               | Likely cause                                                 |
| --------------------- | ------------------------------------------------------------ |
| "Connection refused"  | Wrong port, or qBittorrent-nox is not running                |
| "Network unreachable" | Wrong host, VPN not connected, or firewall blocking the port |
| "Unauthorized"        | Wrong username or password                                   |
| Timeout               | Host is unreachable or behind a firewall                     |
