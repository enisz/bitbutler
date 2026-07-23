---
title: First Steps
description: Adding your first server and connecting to it for the first time.
---

# First Steps

BitButler doesn't talk to torrents directly - it's a remote control for a qBittorrent-nox instance you already have running somewhere. The first thing to do after installing it is add that server as a connection.

## Adding Your First Server

On first launch, BitButler shows the login screen with no servers configured. Click **Add Server** to open the connection editor and enter your qBittorrent-nox instance's protocol, host, port, and credentials. See [Manage > Servers](./user-interface/manage/servers) for every field in the editor, including path mappings and setting a server as the default.

## Connecting

Once saved, the new server appears in the login screen's server list. Select it and click **Connect** to log in. If credentials are wrong or the server is unreachable, BitButler shows an error on the login screen instead of navigating away - correct the connection and try again.

## Arriving at the Torrent List

A successful connection takes you straight to the main window, showing every torrent already on that server. See [Torrent List View](./user-interface/torrent-list-view) for a full tour of the toolbar, sidebar filters, and status bar.

## Automatic .torrent File Handling

BitButler registers itself as a handler for `.torrent` files. Double-clicking one on your system - whether BitButler is already running or not - launches or focuses the app and opens the Add Torrent dialog with that file preloaded, ready to pick a server and save location. The same applies to `.bbe` files (BitButler's own export format): opening one launches or focuses the app and opens the Import Window with that archive loaded.
