---
title: Importálás ablak
description: Torrentek visszaállítása egy BitButler exportarchívumból a jelenleg csatlakoztatott szerverre.
---

# Importálás ablak

![Importálás ablak archívumadatokkal, importálandó torrentekkel és visszaállítási opciókkal](/screenshots/import-window/overview.png)

Az Importálás ablak egy `.bbe` archívumból (a BitButler exportformátuma, lásd [Exportálás ablak](./export-window)) állít vissza torrenteket arra a szerverre, amelyhez éppen csatlakozol. Mindig az aktív kapcsolatba importál - a párbeszédablakon belül nincs célszerver-választó, ezért ha másik célra van szükséged, előbb válts szervert a [Kezelés > Szerverek](./manage/servers) oldalon.

## Az Importálás ablak megnyitása

Nyisd meg az eszköztár natív **Fájl** menüjéből: **Fájl > Torrentek importálása** (vagy **Ctrl+I**), csak bejelentkezve engedélyezett. A menün keresztül nem kötelező elindítani viszont: egy `.bbe` fájlra való dupla kattintás, vagy a BitButler egy ilyen fájllal argumentumként történő indítása megnyitja (vagy előtérbe hozza) az alkalmazást, és közvetlenül betölti azt az archívumot ebbe az ablakba.

## Archívum adatai

![Archívum adatainak összefoglalója](/screenshots/import-window/archive-info.png)

Egy archívum betöltése után egy **Archívum** szakasz foglalja össze: melyik szerverről lett exportálva, melyik szerverre importálod, annak URL-je, az exportálás dátuma, a torrentek száma, a címke- és kategóriaszámok (ha szerepelnek), valamint az exporttípus - **Teljes exportálás** (teljes metaadat, minden visszaállítási opció elérhető) vagy **Örökölt (legacy) exportálás** (csak mágneslinkekből épült, így a fájlátnevezések és fájlprioritások nem állíthatók vissza).

## Tartalom előnézete

![Importálandó torrentek táblázata](/screenshots/import-window/torrents-to-import.png)

Egy **Importálandó torrentek** táblázat felsorolja az archívum minden torrentjét a mentési útvonalával, kategóriájával, címkéivel, sebesség-/arány-/seedelési idő korlátaival és qBittorrent jelzőivel (Auto TMM, Szekvenciális letöltés, Super Seeding, Első/utolsó szelet prioritás), oszloponként rendezhetően és szűrhetően. Minden sorhoz tartozik egy jelölőnégyzet: a célszerveren már meglévő torrentek (hash alapján egyeztetve) alapból nincsenek bejelölve, de bejelölheted őket, hogy újra importáld, és felülírd a beállításaikat. Bármely sor kijelölésének megszüntetése kihagyja azt.

## Visszaállítási opciók

![Visszaállítási opciók kapcsolói](/screenshots/import-window/restore-options.png)

Minden kapcsoló a torrent metaadatainak egy-egy részét szabályozza importáláskor; amit kikapcsolva hagysz, ott a qBittorrent saját alapértelmezése marad érvényben.

- **Mentési útvonal** - visszaállítja a torrent eredeti mentési helyét, előbb átfuttatva a beállított [mentési útvonal-hozzárendelési](#utvonal-hozzarendeles) szabályokon.
- **Kategóriák** - létrehozza az archívumban szereplő, a célszerveren még nem létező kategóriákat (lásd [Kategória útvonal-hozzárendelés](#kategoria-utvonal-hozzarendeles)), és minden torrenthez hozzárendeli a mentett kategóriáját.
- **Címkék** - létrehozza az archívumban szereplő, a célszerveren még nem létező címkéket, majd minden torrenthez alkalmazza a mentett címkéit - egy mentett címke nélküli torrentnél is törlődik minden, ami éppen a célszerveren rajta van, így pontosan az archivált címkekészlet marad rajta.
- **Sebességkorlátok** - visszaállítja minden torrent fel- és letöltési sebességkorlátait.
- **Megosztási korlátok** - visszaállítja minden torrent arány- és seedelésiidő-korlátait.
- **Fájlátnevezések** - visszaállítja a torrent tartalmán belül végzett fájl- és mappaátnevezéseket.
- **Fájlprioritások** - visszaállítja minden fájl letöltési prioritását.
- **Auto-TMM** - visszaállítja az Automatikus torrentkezelés beállítást.
- **Szekvenciális letöltés** - visszaállítja a szekvenciális letöltés beállítást.
- **Super seeding** - visszaállítja a super seeding beállítást.
- **Első/utolsó szelet prioritás** - visszaállítja az első/utolsó szelet prioritás beállítást.

A fájlátnevezések és fájlprioritások örökölt (legacy) exportálás esetén nem elérhetők (és le vannak tiltva), mivel a puszta mágneslinkek nem hordozzák ezt az információt.

## Útvonal-hozzárendelés

![Mentési útvonal-hozzárendelési szabályok](/screenshots/import-window/save-path-remapping.png)

Csak akkor jelenik meg, ha a **Mentési útvonal** visszaállítási opció be van kapcsolva. Minden szabály átírja a mentésiútvonal-előtagot a forrásszerver könyvtárszerkezetéből a célszerverére - hasznos, ha a két szerver nem ugyanazokon az útvonalakon csatolja a tárhelyet. A szabályok sorrendben illeszkednek, és az első illeszkedő előtag nyer.

## Kategória útvonal-hozzárendelés

![Kategória útvonal-hozzárendelési szabályok](/screenshots/import-window/category-path-remapping.png)

Csak akkor jelenik meg, ha a **Kategóriák** visszaállítási opció be van kapcsolva; ugyanúgy működik, mint az útvonal-hozzárendelés, de a kategóriák mentési útvonalaira vonatkozik. A **Meglévő kategóriák felülírása** kapcsoló emellett frissíti a célszerveren már létező kategóriák mentési útvonalát is (a qBittorrent szerkesztési végpontján keresztül), ahelyett hogy érintetlenül hagyná azokat; ez megőrzi a meglévő torrent-hozzárendeléseket, de a qBittorrent [Mentéskezelés](./settings/qbittorrent-settings#menteskezeles) beállításától függően, amely a kategória útvonal-változásaira vonatkozik, minden már ahhoz a kategóriához rendelt torrentnél kikapcsolhatja az Auto TMM-et - nem csak az éppen importáltaknál.

## Importálás után

![Importálás utáni állapotopciók](/screenshots/import-window/after-import.png)

Indítás előtt válaszd ki, milyen állapotban induljanak az importált torrentek: **Szüneteltetve marad**, **Aktívak elindítása** (exportáláskor aktív torrentek folytatása), vagy **Összes elindítása** azonnal, a korábbi állapotuktól függetlenül.

## Importálás folyamata

Elindítás után egy folyamatsáv követi a feldolgozott torrenteket az összeshez képest, alatta az éppen feldolgozott torrent nevével. Amikor végzett, egy összesítés jelenti, hány torrent lett importálva, létezett már, lett kihagyva, illetve hibázott - és minden hibázott sor kiemelve jelenik meg a táblázatban. Az importálás futása közben a Mégse elérhető.
