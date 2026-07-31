---
title: Export Window
description: Export torrents from the connected server to a BitButler .bbe archive.
---

# Export Window

![Export window with connection info, export scope, and save location](/screenshots/export-window/overview.png)

The Export Window packages torrents from the currently connected server - their metadata, categories, and tags - into a single `.bbe` archive file you can later restore with the [Import Window](./import-window).

## Opening the Export Window

Export is reached from the application's native **File** menu: **File > Export Torrents** (**Ctrl+E** / **Cmd+E**). The menu item is only enabled while connected to a server.

## Connection Info

The top of the dialog shows read-only details about the server you're exporting from: its name, URL, WebUI API version, and qBittorrent version. It also reports the **Export type**:

- **Full export** - qBittorrent's export endpoint was detected. The archive embeds each torrent's actual `.torrent` file, so every field can be fully restored on import.
- **Legacy export** - the endpoint wasn't detected. Only magnet links are saved; file renames and per-file priorities can't be restored, since magnet links don't carry file-structure information.

The archive itself does not contain the server's connection details or credentials - only the server's name and an internal identifier, for reference. Restoring it still requires selecting a target server yourself during import.

## Choosing What to Export

Three independent scope pickers control what goes into the archive, each showing a live count:

- **Torrents** - **All**, **Filtered** (whatever the sidebar/search filters currently narrow the list to), or **Selected**.
- **Categories** - **All** categories, or only categories actually **assigned** to the torrents being exported.
- **Tags** - **All** tags, or only tags actually **assigned** to the torrents being exported.

## Save Location

Click **Browse** (or the destination field itself) to choose a folder with the native file picker; it defaults to your Downloads folder. The filename field defaults to `<server-name>-<yyyymmdd>` and always gets a `.bbe` extension.

## Export Progress

Clicking **Export** switches the dialog to a progress view: a bar and a running count (`current / total`) track each torrent as it's fetched, with the torrent currently being processed shown below. When it finishes, a success message appears - noting how many torrents were skipped, if any failed - along with a **Show in Folder** button to reveal the archive. You can **Cancel** while an export is running; a failure shows an inline error instead.
