---
title: Torrent már létezik ablak
description: A Torrent már létezik párbeszédablak, amely duplikált torrentek hozzáadásakor jelenik meg.
---

# Torrent már létezik ablak

Ha olyan torrentet próbálsz hozzáadni, amely már létezik a qBittorrent szerveren, a BitButler a duplikált hozzáadás engedélyezése helyett a Torrent már létezik párbeszédablakot jeleníti meg.

![Torrent már létezik párbeszédablak](/screenshots/torrent-exists/torrent-exists.png)

Ez a párbeszédablak a meglévő torrentről mutat információkat, többek között:

- Folyamat százalékban
- Teljes méret, letöltött és feltöltött mennyiség
- Arány, letöltési sebesség és feltöltési sebesség
- Seedek/leecherek
- Hozzáadás dátuma
- Mentési útvonal
- Kategória és címkék (ha van)

## Opciók

Ebből a párbeszédablakból a következőket teheted:

- **Részletek megnyitása** - Közvetlenül a meglévő torrent részletek nézetére ugrik
- **Bezárás** - Bezárja a párbeszédablakot, és nem hajt végre semmilyen műveletet
- **Törlés** - Eltávolítja a forrás `.torrent` fájlt a lemezről (csak akkor jelenik meg, ha a BitButler beállításaiban engedélyezve van, és a forrás ismert)
