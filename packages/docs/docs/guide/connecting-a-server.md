---
title: Connecting a Server
description: Add, switch between, and manage the qBittorrent-nox servers BitButler connects to.
---

# Connecting a Server

BitButler connects to one or more remote qBittorrent-nox instances over its Web API. Each connection is stored locally (passwords are encrypted at rest) and managed from the **Manage Servers** dialog.

## Adding a Server

Open **Manage Servers** either from the login screen, or from the main window's toolbar: **Manage > Servers**. Click **Add Server** to open the connection editor.

![Add server dialog placeholder](https://placehold.co/600x400/EEE/31343C?text=Add+Server)

### Connection Fields

| Field                          | Description                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connection Name                | A label for this server, shown throughout the UI.                                                                                                                                                                                                |
| Protocol                       | `http` or `https`.                                                                                                                                                                                                                               |
| Host                           | The server's hostname or IP address.                                                                                                                                                                                                             |
| Port                           | The qBittorrent Web UI port, from 1 to 65535.                                                                                                                                                                                                    |
| Username (optional)            | Leave blank if the Web UI doesn't require authentication.                                                                                                                                                                                        |
| Password (optional)            | Leave blank if the Web UI doesn't require authentication. When editing a server with a saved password, this field shows a hint that a password is already saved - leave it blank to keep the existing password, or type a new one to replace it. |
| Set this connection as default | See [Setting a Default Server](#setting-a-default-server) below.                                                                                                                                                                                 |

Click **Save** to add the connection to your server list.

## Switching Servers

The Manage Servers list shows every configured connection, its protocol/host/port, and a plug icon next to whichever one is currently active. Click **Connect** on any other server to switch to it. Use the filter box at the top of the list to search by name or host.

## Setting a Default Server

Marking a connection as default (the checkbox icon next to each server in the list, or the "Set this connection as default" option in the editor) tells BitButler to automatically select and connect to that server on startup, instead of showing the login screen. Only one server can be default at a time - marking a new one clears the previous default.

## Editing and Deleting a Server

From the Manage Servers list, use the pencil icon to reopen a connection in the editor, or the trash icon to delete it. Deleting asks for confirmation first, since it also discards that server's saved [Path Mappings](./advanced/configuration/bitbutler-settings#path-mappings) and polling settings.
