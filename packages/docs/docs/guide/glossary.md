---
title: Glossary
description: Definitions for BitTorrent and BitButler-specific terms used throughout this guide.
---

# Glossary

## Torrent

A small file (`.torrent`) or magnet link describing content available to download over BitTorrent - its file list, sizes, and a hash identifying it uniquely, plus one or more trackers to help find other people sharing it. It isn't the content itself, just the metadata needed to fetch it.

## Tracker

A server that keeps track of who's currently sharing a given torrent, so a new client can find peers to download from. Modern torrents can also find peers without one via DHT, but a tracker is usually still the fastest way in.

## Seed and Peer

### Seed

A peer that already has a complete copy of the torrent's content and continues sharing it with others.

### Peer

Any client participating in a torrent's swarm - downloading, seeding, or both at once. "Seed" is really just a peer that's finished downloading.

## Category and Tag

Both are ways to organize torrents in BitButler, managed from the toolbar's **Manage** group. A torrent can belong to only one [category](./user-interface/manage/categories) at a time, and a category can carry a save path that relocates torrents assigned to it. A torrent can carry any number of [tags](./user-interface/manage/tags) instead, which are for organization only and have no path behavior of their own.
