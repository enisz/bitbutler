---
title: Application Menu
description: The native File, Servers, Settings, and Help menus, and their keyboard accelerators.
---

# Application Menu

BitButler has a native OS menu bar in addition to the in-app toolbar. Some actions - disconnecting, quitting, checking for updates - are only available from here.

## File

| Item            | Shortcut | Notes                                                                         |
| --------------- | -------- | ----------------------------------------------------------------------------- |
| Add Torrent     | `Ctrl+N` | Opens the [Add Torrent](../managing-torrents#adding-torrents) dialog.         |
| Export Torrents | `Ctrl+E` | Opens the [Export Window](./export-window).                                   |
| Import Torrents | `Ctrl+I` | Opens the [Import Window](./import-window).                                   |
| Disconnect      | `Ctrl+L` | Logs out of the current server and returns to the [Login Page](./login-page). |
| Quit            | `Ctrl+Q` | Closes BitButler entirely.                                                    |

Add Torrent, Export Torrents, Import Torrents, and Disconnect are only enabled while connected to a server.

## Servers

Shown only while connected and only if more than one server is configured: a radio-button list of every server, with the active one checked. Selecting another one switches to it immediately, the same as using the toolbar's server dropdown.

## Settings

Shown only while connected:

| Item                 | Shortcut       | Notes                                                        |
| -------------------- | -------------- | ------------------------------------------------------------ |
| BitButler Settings   | `Ctrl+.`       | See [BitButler Settings](./settings/bitbutler-settings).     |
| qBittorrent Settings | `Ctrl+,`       | See [qBittorrent Settings](./settings/qbittorrent-settings). |
| Manage Servers       | `Ctrl+Shift+S` | See [Manage > Servers](./manage/servers).                    |
| Manage Tags          | `Ctrl+Shift+T` | See [Manage > Tags](./manage/tags).                          |
| Manage Categories    | `Ctrl+Shift+C` | See [Manage > Categories](./manage/categories).              |

## Help

| Item              | Shortcut       | Notes                                                                                                                                                        |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Check for Updates | `Ctrl+U`       | Manually triggers the same update check as the "Check for Updates now" button under [BitButler Settings > Behavior](./settings/bitbutler-settings#behavior). |
| User Guide        | `Ctrl+Shift+,` | Opens this documentation site in your default browser, in the app's current language.                                                                        |
| About             | `F1`           | Shows the app's version and related information.                                                                                                             |

On Windows, `Ctrl` is the modifier shown above; on other platforms the same accelerators apply with that platform's usual command modifier.
