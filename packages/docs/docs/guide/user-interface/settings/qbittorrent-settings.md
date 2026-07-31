---
title: qBittorrent Settings
description: Configure the connected qBittorrent-nox server's own bandwidth, queue, seeding ratio, and storage preferences.
---

# qBittorrent Settings

Open this dialog from the toolbar: **Settings > qBittorrent**. Unlike [BitButler Settings](./bitbutler-settings), these preferences live on the qBittorrent-nox server itself - changing them affects every client connected to that server, not just BitButler.

Some fields only appear if the connected qBittorrent-nox version reports support for them. If you don't see a field described below, your server's version likely predates it.

## Bandwidth

![Bandwidth tab](/screenshots/settings/qbittorrent-settings/bandwidth.png)

### Global Rate Limits

Sets the maximum combined download and upload speed across all torrents. Enter `0` for unlimited.

| Field                 | Description                               |
| --------------------- | ----------------------------------------- |
| Download Limit (KB/s) | Maximum combined download speed, in KB/s. |
| Upload Limit (KB/s)   | Maximum combined upload speed, in KB/s.   |

### Alternative Rate Limits (Turtle Mode)

Throttled speed limits used when Turtle Mode is manually enabled or activated by the scheduler below.

| Field                             | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| Alternative Download Limit (KB/s) | Download speed cap applied while Turtle Mode is active. |
| Alternative Upload Limit (KB/s)   | Upload speed cap applied while Turtle Mode is active.   |

### Speed Scheduler

_(Only shown if your qBittorrent-nox version supports scheduling.)_

Automatically switches to the alternative rate limits during a configured time window on selected days.

- **Enable speed scheduler** - turns the schedule on or off.
- **Active on** - Every day, Every weekday, Every weekend, or a specific day of the week.
- **From / To** - the hour and minute the alternative limits start and stop applying.

## Storage

![Storage tab](/screenshots/settings/qbittorrent-settings/storage.png)

### Default Paths

- **Default Save Path** - where new torrents are saved unless overridden by a category or a per-torrent choice.

### Temporary Files

_(Only shown if your qBittorrent-nox version supports a separate incomplete-files path.)_

- **Keep incomplete torrents in a separate folder** - toggles a dedicated **Incomplete Save Path** used while a torrent is still downloading; once complete, files move to the default (or category) save path.

### File Management

- **Append `.!qB` extension to incomplete files** - marks in-progress files so other tools can distinguish them from finished downloads.
- **Torrent content layout** _(only shown if supported by your server)_ - Original, Create subfolder, or Don't create subfolder, controlling whether multi-file torrents get wrapped in an extra folder.

### Save Management

| Field                           | Options                                   | Description                                                                                                                                  |
| ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Default torrent management mode | Automatic / Manual                        | Automatic mode lets qBittorrent relocate torrent files when a category's save path changes; Manual leaves file locations entirely up to you. |
| When torrent category changes   | Relocate torrents / Switch to Manual mode | Behavior applied when a torrent's category is reassigned.                                                                                    |
| When category save path changes | Relocate torrents / Switch to Manual mode | Behavior applied when a category's own save path is edited.                                                                                  |
| When default save path changes  | Relocate torrents / Switch to Manual mode | Behavior applied when the server's default save path (above) is edited.                                                                      |

## Queue & Limits

![Queue & Limits tab](/screenshots/settings/qbittorrent-settings/queue-limits.png)

Control how many torrents can be active at once and how new torrents are queued.

### Active Torrent Management

| Field                              | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| Enable torrent queuing constraints | Turns queuing on; without it, every torrent runs concurrently. |
| Maximum active downloads           | Cap on simultaneously downloading torrents.                    |
| Maximum active uploads             | Cap on simultaneously seeding torrents.                        |
| Maximum total active torrents      | Combined cap across downloads and uploads.                     |

### Download Behavior

_(Only shown if your qBittorrent-nox version supports it.)_

- **Add new torrents to the top of the queue** - new torrents jump ahead of already-queued ones instead of joining at the bottom.

## Seeding Ratios

![Seeding Ratios tab](/screenshots/settings/qbittorrent-settings/seeding-ratios.png)

Automatically stop seeding based on a share ratio target, a time threshold, or both.

### Share Ratio Limits

| Field                           | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| Enable Share Ratio Limit        | Turns the ratio limit on.                                 |
| Stop seeding when ratio reaches | The upload/download ratio that triggers the action below. |
| Action when limit is reached    | Pause torrent or Remove torrent.                          |

### Seeding Time Limits

| Field                        | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| Enable Seeding Time Limit    | Turns the time limit on.                           |
| Stop seeding after (minutes) | How long to seed before the action above is taken. |
