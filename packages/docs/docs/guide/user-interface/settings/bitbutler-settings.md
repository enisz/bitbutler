---
title: BitButler Settings
description: Configure BitButler's application-level settings - startup behavior, appearance, per-server connection behavior, the status bar, and the torrent list grid.
---

# BitButler Settings

BitButler Settings control the application itself: startup behavior, appearance, per-server connection behavior, the status bar, and the torrent list grid. They are stored locally by BitButler and are independent of the qBittorrent-nox server you connect to - for the server's own preferences, see [qBittorrent Settings](./qbittorrent-settings).

Open the dialog from the toolbar: **Settings > BitButler**. The dialog has four tabs; a tab with unsaved changes shows a small asterisk next to its label. Changes across all tabs are saved together with the **Save** button.

## General

![General tab](/screenshots/settings/bitbutler-settings/general.png)

### Startup

| Setting                   | Description                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Start app with the system | Automatically launches BitButler when the operating system starts.                                                                            |
| Start minimized           | Hides the application window on startup; BitButler stays accessible from the system tray. Requires "Start app with the system" to be enabled. |
| Automatic updates         | Checks for BitButler updates automatically every time the app starts.                                                                         |

If "Start app with the system" is enabled but no server is marked as the default connection, a warning hint appears here reminding you that the app will start without logging in automatically. See [Setting a Default Server](../manage/servers#setting-a-default-server).

To check for updates right away instead of waiting for the next launch, use **Help > Check for Updates** in the [application menu](../application-menu#help).

### Torrent Handling

| Setting                                                          | Description                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete torrent files after adding them to the list               | Removes the local `.torrent` file from disk once it has been added successfully.                                                                                                                                                          |
| Delete torrent files when the torrent already exists in the list | Automatically removes the source `.torrent` file from disk when it's added again as a duplicate. Requires "Delete torrent files after adding them to the list" to be enabled - see the [Torrent Exists Window](../torrent-exists-window). |

Save Path Input controls how save-path fields behave throughout the app when adding or moving torrents, and for the Remote Path field on the [Server tab](#server) below - each option shows a live preview so you can compare them before choosing:

- **ng-select** - a dropdown populated with folders discovered on the connected server.
- **ngb-typeahead** - a free-text field with autocomplete suggestions as you type.

### Localization

| Setting           | Description                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language          | Sets the UI language: **English** or **Hungarian**. Changing it updates the renderer immediately and also rebuilds the tray and application menu labels.                                |
| Date format       | A preset: Follow language, ISO, US, European, or Custom.                                                                                                                                |
| First day of week | Auto, Sunday, Monday, or Saturday.                                                                                                                                                      |
| Custom pattern    | Only shown when the date format preset is Custom. A free-text pattern built from the tokens below, with a live preview and a reset button next to it that restores the default pattern. |

Click **Token guide** to expand a reference table of the tokens you can use in the pattern (collapsed by default), shown below (example values are for a sample date of Tuesday, April 5th 2026, 14:05:09 PM):

| Token  | Description              | Example |
| ------ | ------------------------ | ------- |
| `yyyy` | 4-digit year             | 2026    |
| `yy`   | 2-digit year             | 26      |
| `MMMM` | Full month name          | April   |
| `MMM`  | Abbreviated month name   | Apr     |
| `MM`   | 2-digit month            | 04      |
| `M`    | Month number             | 4       |
| `EEEE` | Full weekday name        | Tuesday |
| `EEE`  | Abbreviated weekday name | Tue     |
| `dd`   | 2-digit day of month     | 05      |
| `d`    | Day of month             | 5       |
| `HH`   | 2-digit hour (24h)       | 14      |
| `H`    | Hour (24h)               | 14      |
| `hh`   | 2-digit hour (12h)       | 02      |
| `h`    | Hour (12h)               | 2       |
| `mm`   | 2-digit minute           | 05      |
| `ss`   | 2-digit second           | 09      |
| `a`    | AM/PM marker             | PM      |

Wrap literal text in single quotes (e.g. `'at'`) to include it in the pattern as-is.

### Appearance

| Setting                              | Description                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Theme Family                         | The overall color palette: BitButler, Aurora, Mint Green, Purple Haze, Ocean Breeze, Pumpkin Spice, Deep Sea, or Crimson Ember. |
| Theme Mode                           | Light, Dark, or System (follows the OS theme).                                                                                  |
| In-application notification position | Where toast notifications appear: Top Left, Top Right, Bottom Right, or Bottom Left.                                            |

## Server

![Server tab](/screenshots/settings/bitbutler-settings/server.png)

Unlike the General tab, Server settings are stored **per connection** - each server you add in [Manage Servers](../manage/servers) has its own polling interval and path-mapping configuration.

### Polling

BitButler polls the qBittorrent Web API to keep the torrent list in sync.

| Setting                     | Description                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Foreground polling interval | How often to poll while the app window is open, from 1 to 10 seconds.                                                                    |
| Background polling interval | How often to poll while the app is minimized to the system tray - set this higher to reduce network traffic while the app isn't in view. |

Setting either interval below 2 seconds shows a warning, since polling too aggressively can cause problems.

### Path Mappings

If a server's torrent download folders are also mounted locally (for example, a network share), you can map the server's remote path to its local equivalent. This lets BitButler open the correct local folder in your operating system's native file browser from the Torrent Details view, or from the torrent list when [row double-click behavior](#torrent-list-grid) is set to "Show in Folder / Open Destination".

Each row maps a **Remote Path** to a **Local Path**; the Remote Path field is the same [Save Path Input](#torrent-handling) control used elsewhere, so it's a dropdown or a free-text field depending on that General tab setting. Use **Browse** to pick the local folder, and **Test mapping** to confirm the mapping resolves to a real one. The button at the end of a row clears its fields if it's the only row left, or removes the row entirely if there's more than one; a **+** button on the last row adds a new one once both of its fields are filled in.

## Torrent List Grid

![Torrent List Grid tab](/screenshots/settings/bitbutler-settings/torrent-list-grid.png)

### Grid Options

| Setting        | Description                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| Animate Rows   | Animates rows when their values change. Turn off if you notice performance issues on large lists.            |
| Pagination     | Paginates the torrent list instead of rendering every row at once - helps performance with very large lists. |
| Compact Rows   | Reduces row height and cell padding for a denser view.                                                       |
| Pause on Modal | Pauses background polling whenever any modal dialog is open; polling resumes automatically when it closes.   |

Row double-click behavior controls what happens when you double-click a torrent row:

- **Show in Folder / Open Destination** - opens the destination folder (and selects the file, for single-file torrents). Requires [Path Mappings](#path-mappings) to be configured for that server.
- **Open Torrent Details** - opens the Torrent Details view.
- **Inline Edit** - makes eligible cells directly editable in the grid: double-click a cell to edit, Enter to confirm, Escape to cancel. Only columns backed directly by a qBittorrent API field (no computed/formatted value) are editable.
- **Do nothing** - disables the double-click action.

### Columns

- **Order** - drag to reorder the columns you've enabled; this is also the left-to-right order shown in the torrent grid. Each row also has **Move to Top**, **Move Up**, **Move Down**, **Move to Bottom**, and **Remove** buttons, so you can reorder or drop a column without dragging.
- **Column Pool** - a searchable multi-select of every available column. The **Reset** button above it restores the visible columns and their order to the defaults.

## Status Bar

![Status Bar tab](/screenshots/settings/bitbutler-settings/status-bar.png)

Configure the visibility and order of the widgets shown in the status bar at the bottom of the main window. Drag widgets between the **Widget Pool** (disabled/unused, shown as plain labels) and the **Left** or **Right** column to enable, disable, or reorder them - widgets in the Left/Right columns render as a live-style preview with sample data, so you can see roughly how each one will look before saving. The **Reset to Defaults** button above the widget pool restores the default widget layout.

Available widgets:

- Connection Status
- DHT Nodes
- Global Session Ratio
- Global Total Ratio
- Global Session Downloaded
- Global Total Downloaded
- Global Session Uploaded
- Global Total Uploaded
- Download Speed
- Upload Speed
- Disk Space
- Selection Info
- Polling Indicator
