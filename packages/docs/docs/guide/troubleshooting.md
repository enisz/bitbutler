---
title: Troubleshooting
description: Common connection and performance issues, and how to report a bug.
---

# Troubleshooting

If something isn't working the way you expect, start here before opening an issue.

## Connection Issues

Clicking **Connect** on the login screen and getting an error means BitButler couldn't complete a login against that server's Web API. BitButler shows a toast with the underlying error and keeps you on the login screen either way, rather than navigating away - so you can fix the connection and try again immediately. Double-check the connection's protocol, host, and port in [Manage > Servers](./user-interface/manage/servers).

### Server Unreachable

If the server itself can't be reached (wrong host/port, the qBittorrent-nox process isn't running, a firewall is blocking the connection, or the protocol is set to the wrong one), the error toast surfaces a low-level network failure message rather than a BitButler-specific one. Confirm the qBittorrent-nox Web UI is reachable at that address by other means (e.g. a browser) before assuming it's a BitButler-side problem.

### Authentication Failures

If BitButler does reach the server but the login itself is rejected, the toast reports a login failure and suggests checking your username/password and the server's WebUI settings. If a server has no saved username or password, BitButler prompts for credentials before attempting to connect - re-enter them there, or edit the saved connection directly in [Manage > Servers](./user-interface/manage/servers).

## Performance Problems

If the torrent list feels sluggish with a large number of torrents, check [BitButler Settings > Torrent List Grid](./user-interface/settings/bitbutler-settings#torrent-list-grid): turning off **Animate Rows**, enabling **Pagination**, and turning on **Compact Rows** all reduce rendering work. **Pause on Modal** also stops background polling while any dialog is open, which helps if opening dialogs feels slow while a sync is in progress. If the app itself feels laggy rather than the grid specifically, check the [polling intervals](./user-interface/settings/bitbutler-settings#polling) for the connection you're on - a very short foreground or background interval increases network and CPU load on every poll.

## Reporting an Issue

BitButler is open-source - if something is broken or missing, open an issue on [GitHub](https://github.com/enisz/bitbutler/issues) using the **Bug Report** template (or **Feature Request** / **Enhancement**, if it's not a bug).
