---
title: 'Installation'
order: 1
---

# Installation

BitButler is distributed as a native desktop application for Linux and Windows.

## Linux

Download the package format that matches your distribution from the [releases page](https://github.com/enisz/bitbutler/releases):

| Format   | Command                                               |
| -------- | ----------------------------------------------------- |
| AppImage | `chmod +x BitButler.AppImage && ./BitButler.AppImage` |
| DEB      | `sudo dpkg -i bitbutler.deb`                          |
| RPM      | `sudo rpm -i bitbutler.rpm`                           |
| Snap     | `sudo snap install bitbutler.snap --dangerous`        |

## Windows

Run the NSIS installer (`BitButler-Setup.exe`) or extract the portable ZIP to any folder and launch `BitButler.exe` directly — no installation required.

## System Requirements

- **Linux**: glibc 2.17+ (most distributions from 2014 onwards)
- **Windows**: Windows 10 or later (64-bit)
- **Network**: Access to a host running `qbittorrent-nox` with the Web UI enabled
