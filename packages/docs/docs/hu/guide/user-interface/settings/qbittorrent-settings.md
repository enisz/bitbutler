---
title: qBittorrent beállítások
description: A csatlakoztatott qBittorrent-nox szerver saját sávszélesség-, sor-, seedelésiarány- és tárolási beállításainak konfigurálása.
---

# qBittorrent beállítások

Nyisd meg ezt a párbeszédablakot az eszköztárból: **Beállítások > qBittorrent**. A [BitButler beállításokkal](./bitbutler-settings) ellentétben ezek a beállítások magán a qBittorrent-nox szerveren élnek - módosításuk minden ahhoz a szerverhez csatlakozó klienst érint, nem csak a BitButlert.

Néhány mező csak akkor jelenik meg, ha a csatlakoztatott qBittorrent-nox verzió jelzi a támogatásukat. Ha nem látod a lent leírt valamelyik mezőt, a szervered verziója valószínűleg még nem támogatja azt.

## Sávszélesség

![Sávszélesség fül](/screenshots/settings/qbittorrent-settings/bandwidth.png)

### Globális sebességkorlátok

Beállítja a maximális kombinált letöltési és feltöltési sebességet az összes torrenten. Adj meg `0`-t korlátlanhoz.

| Mező                     | Leírás                                             |
| ------------------------ | -------------------------------------------------- |
| Letöltési korlát (KB/s)  | Maximális kombinált letöltési sebesség, KB/s-ban.  |
| Feltöltési korlát (KB/s) | Maximális kombinált feltöltési sebesség, KB/s-ban. |

### Alternatív sebességkorlátok (Turtle mód)

Csökkentett sebességkorlátok, amelyeket akkor használ, ha a Turtle mód manuálisan be van kapcsolva, vagy a lenti ütemező aktiválja.

| Mező                                | Leírás                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| Alternatív letöltési korlát (KB/s)  | A letöltési sebesség felső korlátja, amíg a Turtle mód aktív.  |
| Alternatív feltöltési korlát (KB/s) | A feltöltési sebesség felső korlátja, amíg a Turtle mód aktív. |

### Sebességütemező

_(Csak akkor jelenik meg, ha a qBittorrent-nox verziód támogatja az ütemezést.)_

Automatikusan átvált az alternatív sebességkorlátokra egy beállított időablakban, a kiválasztott napokon.

- **Sebességütemező engedélyezése** - be- vagy kikapcsolja az ütemezést.
- **Aktív ekkor** - Minden nap, Minden hétköznap, Minden hétvégén, vagy a hét egy adott napján.
- **Ettől / Eddig** - az óra és perc, amikor az alternatív korlátok elkezdenek és megszűnnek érvényesülni.

## Tárolás

![Tárolás fül](/screenshots/settings/qbittorrent-settings/storage.png)

### Alapértelmezett útvonalak

- **Alapértelmezett mentési útvonal** - hová kerülnek az új torrentek, hacsak egy kategória vagy egy torrentenkénti választás felül nem írja.

### Ideiglenes fájlok

_(Csak akkor jelenik meg, ha a qBittorrent-nox verziód támogat egy külön befejezetlen fájlokhoz tartozó útvonalat.)_

- **Befejezetlen torrentek külön mappában tartása** - be- és kikapcsolja egy dedikált **Befejezetlen mentési útvonal** használatát, amíg egy torrent még letöltés alatt van; befejezés után a fájlok az alapértelmezett (vagy kategória szerinti) mentési útvonalra kerülnek.

### Fájlkezelés

- **`.!qB` kiterjesztés hozzáfűzése a befejezetlen fájlokhoz** - megjelöli a folyamatban lévő fájlokat, hogy más eszközök megkülönböztethessék őket a befejezett letöltésektől.
- **Torrenttartalom elrendezése** _(csak akkor jelenik meg, ha a szervered támogatja)_ - Eredeti, Almappa létrehozása, vagy Ne hozzon létre almappát, amely szabályozza, hogy a többfájlos torrentek egy extra mappába kerüljenek-e csomagolásra.

### Mentéskezelés

| Mező                                                  | Opciók                                    | Leírás                                                                                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alapértelmezett torrentkezelési mód                   | Automatikus / Kézi                        | Automatikus módban a qBittorrent áthelyezheti a torrentfájlokat, amikor egy kategória mentési útvonala megváltozik; Kézi módban a fájlok helye teljesen rád van bízva. |
| Amikor a torrent kategóriája megváltozik              | Torrentek áthelyezése / Váltás kézi módra | A torrent kategóriájának újbóli hozzárendelésekor alkalmazott viselkedés.                                                                                              |
| Amikor a kategória mentési útvonala megváltozik       | Torrentek áthelyezése / Váltás kézi módra | A kategória saját mentési útvonalának szerkesztésekor alkalmazott viselkedés.                                                                                          |
| Amikor az alapértelmezett mentési útvonal megváltozik | Torrentek áthelyezése / Váltás kézi módra | A szerver (fentebbi) alapértelmezett mentési útvonalának szerkesztésekor alkalmazott viselkedés.                                                                       |

## Sor és korlátok

![Sor és korlátok fül](/screenshots/settings/qbittorrent-settings/queue-limits.png)

Szabályozza, hány torrent lehet egyszerre aktív, és hogyan kerülnek sorba az új torrentek.

### Aktív torrentkezelés

| Mező                                   | Leírás                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| Torrentsorolási korlátok engedélyezése | Bekapcsolja a sorolást; nélküle minden torrent egyszerre fut. |
| Maximális aktív letöltések             | Az egyidejűleg letöltés alatt álló torrentek felső korlátja.  |
| Maximális aktív feltöltések            | Az egyidejűleg seedelő torrentek felső korlátja.              |
| Maximális összes aktív torrent         | A letöltések és feltöltések együttes felső korlátja.          |

### Letöltési viselkedés

_(Csak akkor jelenik meg, ha a qBittorrent-nox verziód támogatja.)_

- **Új torrentek hozzáadása a sor elejéhez** - az új torrentek a már sorban lévők elé kerülnek, ahelyett hogy a végére csatlakoznának.

## Seedelési arányok

![Seedelési arányok fül](/screenshots/settings/qbittorrent-settings/seeding-ratios.png)

Automatikusan leállítja a seedelést egy megosztásiarány-cél, egy időküszöb, vagy mindkettő alapján.

### Megosztásiarány-korlátok

| Mező                                   | Leírás                                                    |
| -------------------------------------- | --------------------------------------------------------- |
| Megosztásiarány-korlát engedélyezése   | Bekapcsolja az aránykorlátot.                             |
| Seedelés leállítása, ha az arány eléri | A fel-/letöltési arány, amely kiváltja a lenti műveletet. |
| Művelet a korlát elérésekor            | Torrent szüneteltetése vagy Torrent eltávolítása.         |

### Seedelésiidő-korlátok

| Mező                                      | Leírás                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| Seedelésiidő-korlát engedélyezése         | Bekapcsolja az időkorlátot.                            |
| Seedelés leállítása ennyi idő után (perc) | Mennyi ideig seedeljen, mielőtt a fenti művelet lefut. |
