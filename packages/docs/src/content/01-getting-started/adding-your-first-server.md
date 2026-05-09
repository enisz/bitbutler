---
title: 'Adding Your First Server'
order: 2
---

# Adding Your First Server

Before you can manage torrents, you need to connect BitButler to a qBittorrent-nox instance.

<!-- screenshot: login-screen-overview -->

![Login screen overview](./screenshots/login-screen-overview.png)

> **Callouts:**
>
> 1. **Server dropdown** - shows the currently selected server, or "No server selected" if none exist yet
> 2. **Add server button** - opens the add server form
> 3. **Edit / Delete buttons** - modify or remove the selected server
> 4. **Check connection button** - tests whether the selected server is reachable

## What you need

Before adding a server, have the following ready:

- The **hostname or IP address** of the machine running qBittorrent-nox
- The **port** the Web UI is listening on (default: `8080`)
- Your qBittorrent **username and password**

## Steps

1. Click the **Add server** button (callout 2 above).

<!-- screenshot: add-server-form -->

![Add server form](./screenshots/add-server-form.png)

> **Callouts:**
>
> 1. **Name** - a friendly label for this server (e.g. "Home NAS")
> 2. **Host** - hostname or IP address (e.g. `192.168.1.10` or `nas.local`)
> 3. **Port** - Web UI port (default `8080`)
> 4. **Username / Password** - your qBittorrent Web UI credentials
> 5. **Use HTTPS** - enable if your qBittorrent instance uses TLS

2. Fill in the server details and click **Save**.
3. The new server appears in the dropdown. Click **Check connection** to verify it is reachable.

## Next step

With your server added, [log in](./logging-in).
