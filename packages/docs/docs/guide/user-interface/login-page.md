---
title: Login Page
description: Select a server, connect, and reach quick settings before the main window loads.
---

# Login Page

The login screen is what BitButler shows before you're connected to a server - on startup, or after logging out.

![Login page placeholder](https://placehold.co/600x400/EEE/31343C?text=Login+Page)

## Server Selection

If no servers are configured yet, the screen shows a single **Add Server** button. Once at least one server exists, that's replaced by a dropdown to pick which configured server to connect to, a **Connect** button, and a **Manage Servers** button.

Click **Connect** to log in to the selected server. If that server has no saved username or password, a credential prompt appears first, with an option to save what you enter for next time. A failed connection shows an error toast and keeps you on the login screen; a successful one navigates straight to the main window.

If a server is marked as the default connection, BitButler selects it automatically and connects to it as soon as the login screen loads, skipping the manual **Connect** click entirely - unless you just logged out, in which case auto-login is suppressed for that one visit to the screen.

## Managing Servers

Click **Add Server** (when no servers exist) or **Manage Servers** (once at least one does) to open the connection editor. See [Manage > Servers](./manage/servers) for every field, plus how to edit, delete, and set a default connection.

## Quick Settings

Three icon buttons sit next to the app version (a link to the release notes) in the bottom corner, and apply immediately without needing to connect to a server first:

- **Language** - English or Hungarian.
- **Theme Family** - the overall color palette: BitButler, Aurora, Crimson Ember, Deep Sea, Mint Green, Ocean Breeze, Pumpkin Spice, or Purple Haze.
- **Theme Mode** - Light, Dark, or System.

These are the same settings available in [BitButler Settings > Appearance](./settings/bitbutler-settings#appearance).
