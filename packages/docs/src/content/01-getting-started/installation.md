---
title: 'Installation'
order: 1
---

# Installation

Download and install BitButler on your operating system.

## System requirements

- **qBittorrent-nox** running on a reachable host with the Web UI enabled
- One of the following operating systems:
  - Windows 10 or later
  - macOS 12 (Monterey) or later
  - Linux (AppImage, DEB, RPM, Snap, or tar.gz)

## Download

Go to the [Releases page](https://github.com/enisz/bitbutler/releases) on GitHub and download
the installer for your platform:

| Platform | File to download                                   |
| -------- | -------------------------------------------------- |
| Windows  | `.exe` (NSIS installer) or `.zip` (portable)       |
| macOS    | `.dmg`                                             |
| Linux    | `.AppImage`, `.deb`, `.rpm`, `.snap`, or `.tar.gz` |

## Install

### Windows

Run the downloaded `.exe` installer and follow the prompts. The app installs to `%LOCALAPPDATA%\Programs\BitButler` by default.

For a portable install, extract the `.zip` and run `BitButler.exe` directly - no installation required.

### macOS

Open the `.dmg` file and drag BitButler to your Applications folder.

### Linux

**AppImage** - mark the file as executable and run it:

```bash
chmod +x BitButler-*.AppImage
./BitButler-*.AppImage
```

**DEB (Debian/Ubuntu):**

```bash
sudo dpkg -i bitbutler_*.deb
```

**RPM (Fedora/RHEL):**

```bash
sudo rpm -i bitbutler-*.rpm
```

**Snap:**

```bash
sudo snap install bitbutler_*.snap --dangerous
```

## Next step

Once BitButler is running, [add your first server](./adding-your-first-server).
