---
title: 'Server Settings'
order: 2
---

# Server Settings

Open **Settings → Server** to configure polling intervals and path mappings for the
currently connected server.

<!-- screenshot: settings-server -->

![Server settings tab](./screenshots/settings-server.png)

> **Callouts:**
>
> 1. **Foreground polling interval** — how often (in ms) the app fetches data when the window is focused
> 2. **Background polling interval** — how often (in ms) the app fetches data when the window is in the background
> 3. **Path mappings list** — maps remote server paths to local file system paths
> 4. **Add mapping button** — adds a new path mapping row

## Polling

BitButler continuously syncs with qBittorrent in the background.

| Setting             | Default | Effect                                                    |
| ------------------- | ------- | --------------------------------------------------------- |
| Foreground interval | 2000 ms | Fetch frequency when you are actively using the app       |
| Background interval | 5000 ms | Fetch frequency when the window is minimized or unfocused |

Lowering these values gives more up-to-date information but increases load on the qBittorrent server.
Values below 500 ms are not recommended.

## Path mappings

Path mappings are used when you **open a torrent's save path** in your local file manager.
Because qBittorrent runs on a remote server, its paths (e.g. `/data/downloads`) are not directly
accessible from your computer. A path mapping tells BitButler how to translate a remote path
to an equivalent local path (e.g. a network share mounted at `Z:\downloads` on Windows or
`/mnt/nas/downloads` on Linux).

### Adding a mapping

1. Click **Add mapping**.
2. Enter the **remote path** — the path as qBittorrent reports it (e.g. `/data/downloads`).
3. Enter the **local path** — the equivalent path on your computer.
4. Click **Test** to verify the local path exists and is accessible.

### Tips

- Use the **Browse** button to pick the local path from a file picker.
- Existing torrent save paths are shown as suggestions to help you identify what to map.
- You can add multiple mappings for different directories.
