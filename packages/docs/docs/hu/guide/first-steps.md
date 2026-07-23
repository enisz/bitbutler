---
title: Első lépések
description: Az első szerver hozzáadása és a hozzá való csatlakozás.
---

# Első lépések

A BitButler nem áll közvetlen kapcsolatban a torrentekkel - egy távirányító egy már valahol futó qBittorrent-nox példányhoz. A telepítés utáni első teendő ennek a szervernek a hozzáadása kapcsolatként.

## Az első szerver hozzáadása

Első indításkor a BitButler a bejelentkezési képernyőt mutatja, beállított szerverek nélkül. Kattints a **Szerver hozzáadása** gombra a kapcsolatszerkesztő megnyitásához, és add meg a qBittorrent-nox példányod protokollját, gépnevét, portját és hitelesítő adatait. Lásd [Kezelés > Szerverek](./user-interface/manage/servers) a szerkesztő összes mezőjéért, beleértve az útvonal-hozzárendeléseket és az alapértelmezett szerver beállítását.

## Csatlakozás

Mentés után az új szerver megjelenik a bejelentkezési képernyő szerverlistájában. Válaszd ki, majd kattints a **Csatlakozás** gombra a bejelentkezéshez. Ha a hitelesítő adatok hibásak, vagy a szerver nem elérhető, a BitButler hibaüzenetet jelenít meg a bejelentkezési képernyőn ahelyett, hogy tovább navigálna - javítsd a kapcsolatot, és próbáld újra.

## Megérkezés a torrentlistához

Egy sikeres kapcsolódás egyenesen a főablakba visz, amely megmutatja az adott szerveren már meglévő összes torrentet. Lásd [Torrentlista nézet](./user-interface/torrent-list-view) az eszköztár, az oldalsáv szűrők és az állapotsáv teljes bemutatásáért.

## Automatikus .torrent fájlkezelés

A BitButler regisztrálja magát a `.torrent` fájlok kezelőjeként. Egy ilyen fájlra való dupla kattintás a rendszeren - függetlenül attól, hogy a BitButler már fut-e - elindítja vagy előtérbe hozza az alkalmazást, és megnyitja a Torrent hozzáadása párbeszédablakot az adott fájllal előre betöltve, készen a szerver és a mentési hely kiválasztására. Ugyanez vonatkozik a `.bbe` fájlokra is (a BitButler saját exportformátuma): egy ilyen megnyitása elindítja vagy előtérbe hozza az alkalmazást, és megnyitja az Importálás ablakot a betöltött archívummal.
