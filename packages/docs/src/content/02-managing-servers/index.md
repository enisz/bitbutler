---
title: 'Managing Servers'
order: 1
---

# Managing Servers

The login screen is where you add, edit, remove, and test qBittorrent server connections.
To return to the login screen from the main view, disconnect from the current server (see
[Switching Servers](./switching-servers)).

<!-- screenshot: login-screen-full -->

![Login screen full view](./screenshots/login-screen-full.png)

> **Callouts:**
>
> 1. **Server dropdown** - lists all saved servers; select one to make it active
> 2. **Add button** - opens the add server form
> 3. **Edit button** - opens the edit form for the currently selected server
> 4. **Delete button** - removes the selected server (cannot be undone)
> 5. **Check connection button** - tests whether the selected server is currently reachable
> 6. **Connect button** - logs in to the selected server and opens the main screen

## Adding a server

Click **Add** to open the server form. Fill in:

| Field     | Description                                                   |
| --------- | ------------------------------------------------------------- |
| Name      | A friendly label (e.g. "Home NAS", "VPS")                     |
| Host      | Hostname or IP address of the machine running qBittorrent-nox |
| Port      | Web UI port (default: `8080`)                                 |
| Username  | qBittorrent Web UI username                                   |
| Password  | qBittorrent Web UI password                                   |
| Use HTTPS | Enable if the Web UI is behind TLS                            |

Click **Save** to store the server. Passwords are encrypted using the operating system's
secure storage (Keychain on macOS, DPAPI on Windows, libsecret on Linux).

## Editing a server

Select a server in the dropdown, then click **Edit**. Update any fields and click **Save**.

## Deleting a server

Select a server and click **Delete**. The server is removed immediately - there is no undo.
