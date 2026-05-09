---
title: 'General Settings'
order: 1
---

# General Settings

Open **Settings → General** to configure the app's appearance, language, and behavior.

<!-- screenshot: settings-general -->

![General settings tab](./screenshots/settings-general.png)

> **Callouts:**
>
> 1. **Theme family** - the color palette (8 built-in themes)
> 2. **Theme mode** - Light, Dark, or System (follows OS preference)
> 3. **Language** - UI language selector
> 4. **Delete .torrent file** - auto-delete the local file after adding to qBittorrent
> 5. **Check for updates** - check GitHub for new releases on startup
> 6. **Toast position** - corner where notification pop-ups appear

## Appearance

### Theme family

Choose one of eight built-in color palettes:

| Theme         | Character                 |
| ------------- | ------------------------- |
| BitButler     | Default blue-grey palette |
| Aurora        | Purple and pink tones     |
| Mint Green    | Fresh greens              |
| Purple Haze   | Deep purples              |
| Ocean Breeze  | Cool teals and blues      |
| Pumpkin Spice | Warm oranges              |
| Deep Sea      | Dark navy blues           |
| Crimson Ember | Reds and dark tones       |

### Theme mode

| Mode   | Behavior                                           |
| ------ | -------------------------------------------------- |
| Light  | Always use the light variant of the selected theme |
| Dark   | Always use the dark variant                        |
| System | Match the operating system's light/dark setting    |

## Language

Switches the language of all UI text. Currently supported: **English** and **Hungarian**.
Changing the language takes effect immediately and also updates the system tray menu
and application menu labels.

## Behavior

### Delete .torrent file after adding

When enabled, BitButler deletes the local `.torrent` file from your computer after it has been
successfully sent to qBittorrent. Disabled by default.

### Check for updates automatically

When enabled, BitButler checks GitHub for a newer release each time the app starts and shows
a notification if one is available. Enabled by default.

### Toast position

Controls which corner of the screen notification toasts appear in.

| Option       | Position                     |
| ------------ | ---------------------------- |
| Top left     | Upper-left corner            |
| Top right    | Upper-right corner           |
| Bottom right | Lower-right corner (default) |
| Bottom left  | Lower-left corner            |
