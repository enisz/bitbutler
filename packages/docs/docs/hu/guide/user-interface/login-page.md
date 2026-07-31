---
title: Bejelentkezési oldal
description: Válassz szervert, csatlakozz, és érd el a gyorsbeállításokat, mielőtt betöltődik a főablak.
---

# Bejelentkezési oldal

![Bejelentkezési oldal beállított szerver nélkül](/screenshots/login-page/no-server.png)

A bejelentkezési képernyőt a BitButler azelőtt mutatja, hogy csatlakoznál egy szerverhez - induláskor, vagy kijelentkezés után.

## Szerverválasztás

![Bejelentkezési oldal kiválasztott szerverrel](/screenshots/login-page/with-server-selected.png)

Ha még nincs beállítva szerver, a képernyő egyetlen **Szerver hozzáadása** gombot mutat. Amint legalább egy szerver létezik, ezt egy legördülő menü váltja fel a csatlakoztatandó szerver kiválasztásához, egy **Csatlakozás** gomb és egy **Szerverek kezelése** gomb.

Kattints a **Csatlakozás** gombra a kiválasztott szerverre való bejelentkezéshez. Ha ahhoz a szerverhez nincs mentett felhasználónév vagy jelszó, előbb egy hitelesítő adat kérő ablak jelenik meg, azzal a lehetőséggel, hogy a megadottakat elmentse a következő alkalomra. Egy sikertelen kapcsolódás hibaüzenetet mutat, és a bejelentkezési képernyőn tart; egy sikeres egyenesen a főablakba navigál.

Ha egy szerver alapértelmezett kapcsolatként van megjelölve, a BitButler automatikusan kiválasztja, és azonnal csatlakozik hozzá, amint betöltődik a bejelentkezési képernyő, teljesen kihagyva a manuális **Csatlakozás** kattintást - kivéve, ha épp az imént jelentkeztél ki, amely esetben az automatikus bejelentkezés az adott egy alkalommal letiltásra kerül a képernyőn.

## Szerverek kezelése

![Új kapcsolat szerkesztője](/screenshots/login-page/adding-first-server.png)

![Szerverek kezelése párbeszédablak](/screenshots/login-page/server-manager.png)

Kattints a **Szerver hozzáadása** gombra (ha nincs szerver), vagy a **Szerverek kezelése** gombra (ha már van legalább egy) a kapcsolatszerkesztő megnyitásához. Lásd [Kezelés > Szerverek](./manage/servers) az összes mezőért, valamint a szerkesztés, törlés és alapértelmezett kapcsolat beállításának módjáért.

## Gyorsbeállítások

![Gyorsbeállítás ikonok](/screenshots/login-page/quick-settings.png)

Három ikon gomb található az alkalmazás verziója mellett (amely egy hivatkozás a kiadási megjegyzésekre) a sarokban, és azonnal érvénybe lépnek, anélkül hogy előbb csatlakozni kellene egy szerverhez:

- **Nyelv** - angol vagy magyar.
- **Témacsalád** - az általános színpaletta: BitButler, Aurora, Crimson Ember, Deep Sea, Mint Green, Ocean Breeze, Pumpkin Spice vagy Purple Haze.
- **Témamód** - Világos, Sötét vagy Rendszerszintű.

Ezek ugyanazok a beállítások, amelyek a [BitButler beállítások > Megjelenés](./settings/bitbutler-settings#megjelenes) alatt is elérhetők.
