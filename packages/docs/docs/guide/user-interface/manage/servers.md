---
title: Servers
description: Add, switch between, and manage the qBittorrent-nox servers BitButler connects to.
---

# Servers

![Manage Servers dialog](/screenshots/manage/servers/overview.png)

BitButler connects to one or more remote qBittorrent-nox instances over its Web API. Each connection is stored locally (passwords are encrypted at rest) and managed from the **Manage Servers** dialog.

## Adding a Server

![New Connection editor](/screenshots/manage/servers/add-server.png)

Open **Manage Servers** either from the login screen, or from the main window's toolbar: **Manage > Servers**. Click **Add Server** to open the connection editor.

### Connection Fields

| Field                          | Description                                                                                                                                                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection Name                | A label for this server, shown throughout the UI.                                                                                                                                                                                                                                                   |
| Protocol                       | `http` or `https`.                                                                                                                                                                                                                                                                                  |
| Host                           | The server's hostname or IP address.                                                                                                                                                                                                                                                                |
| Port                           | The qBittorrent Web UI port, from 1 to 65535.                                                                                                                                                                                                                                                       |
| Username (optional)            | Leave blank if the Web UI doesn't require authentication.                                                                                                                                                                                                                                           |
| Password (optional)            | Leave blank if the Web UI doesn't require authentication. When editing a server with a saved password, this field shows a hint that a password is already saved - leaving it blank **removes** the saved password, so re-enter it (or a new one) if you want to keep credentials on the connection. |
| Set this connection as default | See [Setting a Default Server](#setting-a-default-server) below.                                                                                                                                                                                                                                    |

Click **Save** to add the connection to your server list.

## Switching Servers

The Manage Servers list shows every configured connection, its protocol/host/port, and a plug icon next to whichever one is currently active. Click **Connect** on any other server to switch to it. If that server has no saved username or password, a credential prompt appears first, with an option to save what you enter for next time. Use the filter box at the top of the list to search by name or host.

## Setting a Default Server

Marking a connection as default (the checkbox icon next to each server in the list, or the "Set this connection as default" option in the editor) tells BitButler to automatically select and connect to that server on startup, instead of showing the login screen. Only one server can be default at a time - marking a new one clears the previous default.

## Editing and Deleting a Server

![Manage Servers dialog with multiple servers listed](/screenshots/manage/servers/multiple-servers.png)

From the Manage Servers list, use the pencil icon to reopen a connection in the editor, or the trash icon to delete it. Deleting asks for confirmation first, since the action can't be undone - any [Path Mappings](../settings/bitbutler-settings#path-mappings) or polling settings configured for that connection no longer apply once it's gone.
