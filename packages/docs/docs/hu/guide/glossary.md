---
title: Szószedet
description: A BitTorrenttel és a BitButlerrel kapcsolatos, ebben az útmutatóban használt fogalmak meghatározása.
---

# Szószedet

## Torrent

Egy kis fájl (`.torrent`) vagy mágneslink, amely a BitTorrenten keresztül letölthető tartalmat ír le - a fájllistáját, méreteit, valamint egy egyedi azonosító hash-t, továbbá egy vagy több trackert, amelyek segítenek megtalálni a tartalmat megosztó többi felhasználót. Nem maga a tartalom, csak a lekéréséhez szükséges metaadat.

## Tracker

Egy szerver, amely nyilvántartja, hogy ki oszt meg éppen egy adott torrentet, hogy egy új kliens peereket találhasson, akiktől letölthet. A modern torrentek tracker nélkül, DHT-n keresztül is találhatnak peereket, de a tracker általában így is a leggyorsabb út.

## Seed és Peer

### Seed

Egy peer, amely már a torrent tartalmának teljes másolatával rendelkezik, és tovább osztja meg azt másokkal.

### Peer

Bármely kliens, amely részt vesz egy torrent rajában - letölt, seedel, vagy egyszerre mindkettőt teszi. A "seed" valójában csak egy olyan peer, amely befejezte a letöltést.

## Kategória és Címke

Mindkettő a torrentek rendszerezésének módja a BitButlerben, az eszköztár **Kezelés** csoportjából kezelhető. Egy torrent egyszerre csak egy [kategóriához](./user-interface/manage/categories) tartozhat, és egy kategóriához mentési útvonal is társítható, amely áthelyezi a hozzá rendelt torrenteket. Egy torrent ezzel szemben tetszőleges számú [címkét](./user-interface/manage/tags) viselhet, amelyek csak rendszerezésre szolgálnak, és önmagukban nincs útvonal-viselkedésük.
