---
title: FAQ
description: Common questions about licensing, platform support, and how BitButler relates to qBittorrent-nox.
---

# FAQ

## Is BitButler free to use?

Yes. BitButler is open-source and released under the MIT license.

## Which platforms are supported?

Windows and Linux. Windows is available as an installer, a portable build, or a plain `.zip`; Linux is available as an AppImage, `.deb`, `.rpm`, `.snap`, or `.tar.gz`. See [Getting Started > Installation](./getting-started#installation) for details. There is currently no macOS build.

## Does BitButler run torrents locally?

No. BitButler is a remote client - it connects to a qBittorrent-nox instance you run separately (on a home server, NAS, or VPS, for example) and controls it over qBittorrent's Web API. All actual downloading and seeding happens on that server, not on the machine running BitButler.

Note also that BitButler currently targets qBittorrent v4.1.0 - v4.6.x; using it against the newer v5.x Web API may work but isn't officially supported yet.

## Where can I report a bug?

Open an issue on [BitButler's GitHub repository](https://github.com/enisz/bitbutler). Issue templates are provided for bug reports, enhancements, feature requests, and maintenance tasks - pick whichever fits, or use the general "other" template if none apply.
