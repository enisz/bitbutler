---
title: 'Configuration'
order: 2
---

# Configuration

## Adding a Server

Open **Settings → Servers** and click **Add Server**. Fill in:

- **Name** — a friendly label shown in the server switcher
- **Host** — the hostname or IP of the machine running `qbittorrent-nox`
- **Port** — the Web UI port (default: `8080`)
- **Username / Password** — the credentials you set in qBittorrent Web UI settings

Passwords are encrypted at rest using Electron's `safeStorage` API (OS keychain on supported platforms).

## Multiple Servers

You can add as many servers as you like. Switch between them using the server selector in the top bar. Each server maintains its own session independently.

## Application Settings

General preferences (theme, language, polling interval) are stored under **Settings → General**:

| Setting          | Default | Description                          |
| ---------------- | ------- | ------------------------------------ |
| Theme            | System  | Light, dark, or follow the OS        |
| Language         | English | UI language (English or Hungarian)   |
| Polling interval | 2s      | How often the torrent list refreshes |
