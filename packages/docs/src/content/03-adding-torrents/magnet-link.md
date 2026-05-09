---
title: 'From a Magnet Link or URL'
order: 2
---

# Adding a Torrent from a Magnet Link or URL

Click the **Add link** button in the toolbar to add a torrent from a magnet link or a direct URL to a `.torrent` file.

<!-- screenshot: toolbar-add-link -->

![Add link button in the toolbar](./screenshots/toolbar-add-link.png)

> **Callouts:**
>
> 1. **Add link button** - click to open the URL input

## Steps

1. Click the **Add link** button.
2. Paste a magnet link (e.g. `magnet:?xt=urn:btih:...`) or a direct URL to a `.torrent` file.
3. Click **Add** or press Enter.
4. The [Add Torrent dialog](./options) opens.
5. Review the options and click **Add**.

## Magnet links vs. URLs

| Type         | Example                            | Notes                                                    |
| ------------ | ---------------------------------- | -------------------------------------------------------- |
| Magnet link  | `magnet:?xt=urn:btih:abc123...`    | No file needed; qBittorrent fetches metadata from peers  |
| .torrent URL | `https://example.com/file.torrent` | BitButler downloads the file and sends it to qBittorrent |
