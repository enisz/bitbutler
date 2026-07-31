---
title: Torrent már létezik ablak
description: A Torrent már létezik párbeszédablak, amely duplikált torrentek hozzáadásakor jelenik meg.
---

# Torrent már létezik ablak

![Torrent már létezik párbeszédablak](/screenshots/torrent-exists/torrent-exists.png)

Ha olyan torrentet próbálsz hozzáadni, amely már létezik a qBittorrent szerveren, a BitButler a duplikált hozzáadás engedélyezése helyett a Torrent már létezik párbeszédablakot jeleníti meg.

Ez a párbeszédablak a meglévő torrentről mutat információkat, többek között:

- Folyamat százalékban
- Teljes méret, letöltött és feltöltött mennyiség
- Arány, letöltési sebesség és feltöltési sebesség
- Seedek/leecherek
- Hozzáadás dátuma
- Mentési útvonal
- Kategória és címkék (ha van)

Ha [A torrent fájlok törlése, ha a torrent már szerepel a listában](./settings/bitbutler-settings#viselkedes) engedélyezve van a BitButler beállításaiban, és a forrás `.torrent` fájl ismert, a BitButler automatikusan törli azt a lemezről, amint ez a párbeszédablak megnyílik. Ha a törlés sikertelen, egy felugró értesítés jelzi a hibát.

## Opciók

Ebből a párbeszédablakból a következőket teheted:

- **Részletek megnyitása** - Közvetlenül a meglévő torrent részletek nézetére ugrik
- **Bezárás** - Bezárja a párbeszédablakot, és nem hajt végre semmilyen műveletet
