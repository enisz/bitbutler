---
title: System Tray & Notifications
description: Minimize-to-tray behavior, the tray's quick-action menu, and desktop notifications.
---

# System Tray & Notifications

BitButler stays running in the system tray while minimized, with quick actions available without reopening the main window, and can notify you when a torrent finishes.

## Minimizing to the Tray

Minimizing the main window hides it instead of showing it in the taskbar; the app keeps running and stays reachable from the tray icon. The first time this happens in a session, BitButler shows a one-time notification letting you know it's still running in the background. See [BitButler Settings > Startup](./settings/bitbutler-settings#startup) for **Start minimized**, which launches straight into this state.

Click the tray icon to toggle the main window: if it's hidden or minimized, it's restored and maximized; if it's already visible, clicking hides it again.

## Tray Menu

Right-click (or on some platforms, left-click) the tray icon for a quick-action menu that works even with the main window hidden:

- **Show** / **Hide** - toggles the main window.
- **Start All Torrents** / **Stop All Torrents** - resumes or pauses every torrent on the currently active server.
- **Remove Global Upload Limit** / **Remove Global Download Limit** - clears the server's global transfer limits.
- **Toggle Alternative Speed** - switches the server between its normal and alternative global speed limits.
- **Quit** - closes BitButler completely, including the tray icon.

The torrent-control and transfer-limit items are disabled whenever there's no active, connected server to act on.

## Notifications

When a torrent finishes downloading, BitButler tells you about it one of two ways, depending on whether the main window is currently minimized:

- **Minimized** - a native desktop notification appears, titled "Download Finished" with the torrent's name as its body.
- **Visible** - a success toast appears in-app instead, in the corner configured by the "In-application notification position" setting under [BitButler Settings > Behavior](./settings/bitbutler-settings#behavior).

There's no separate on/off switch for this - it's tied to whether the window is minimized at the moment the torrent completes.
