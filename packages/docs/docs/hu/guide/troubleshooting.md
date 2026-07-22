---
title: Hibaelhárítás
description: Gyakori kapcsolódási és teljesítményproblémák, valamint a hibabejelentés módja.
---

# Hibaelhárítás

Ha valami nem az elvártak szerint működik, mielőtt issue-t nyitnál, kezdd itt.

## Kapcsolódási problémák

Ha a bejelentkezési képernyőn a **Csatlakozás** gombra kattintva hibát kapsz, az azt jelenti, hogy a BitButler nem tudott bejelentkezni az adott szerver webes API-ján. A BitButler mindkét esetben egy értesítést mutat az alapul szolgáló hibával, és a bejelentkezési képernyőn tart, ahelyett hogy továbblépne - így azonnal javíthatod a kapcsolatot, és újra próbálkozhatsz. Ellenőrizd újra a kapcsolat protokollját, gépnevét és portját a [Kezelés > Szerverek](./user-interface/manage/servers) oldalon.

### A szerver nem érhető el

Ha maga a szerver nem érhető el (hibás gépnév/port, a qBittorrent-nox folyamat nem fut, egy tűzfal blokkolja a kapcsolatot, vagy a protokoll rosszra van állítva), a hibaüzenet egy alacsony szintű hálózati hibát jelez, nem BitButler-specifikusat. Mielőtt BitButler-oldali problémát feltételeznél, más módon (például böngészőből) győződj meg róla, hogy a qBittorrent-nox webes felülete elérhető azon a címen.

### Hitelesítési hibák

Ha a BitButler eléri a szervert, de maga a bejelentkezés elutasításra kerül, az értesítés bejelentkezési hibát jelez, és javasolja a felhasználónév/jelszó, valamint a szerver WebUI beállításainak ellenőrzését. Ha egy szerverhez nincs mentett felhasználónév vagy jelszó, a BitButler a csatlakozás megkísérlése előtt bekéri a hitelesítő adatokat - add meg őket ott újra, vagy szerkeszd közvetlenül a mentett kapcsolatot a [Kezelés > Szerverek](./user-interface/manage/servers) oldalon.

## Teljesítményproblémák

Ha a torrentlista lassúnak tűnik nagy számú torrent esetén, ellenőrizd a [BitButler beállítások > Torrenttáblázat](./user-interface/settings/bitbutler-settings#torrenttablazat) menüpontot: a **Sorok animálása** kikapcsolása, az **Oldalszámozás** bekapcsolása és a **Kompakt sorok** bekapcsolása mind csökkenti a renderelési terhelést. A **Szüneteltetés modál esetén** opció is leállítja a háttérbeli lekérdezést, amíg bármely párbeszédablak nyitva van, ami segít, ha a párbeszédablakok megnyitása lassúnak tűnik szinkronizálás közben. Ha maga az alkalmazás tűnik lassúnak, nem kifejezetten a táblázat, ellenőrizd a kapcsolatod [lekérdezési intervallumait](./user-interface/settings/bitbutler-settings#lekerdezes) - egy nagyon rövid előtér- vagy háttérintervallum minden lekérdezésnél növeli a hálózati és CPU-terhelést.

## Hiba bejelentése

A BitButler nyílt forráskódú - ha valami hibás vagy hiányzik, nyiss egy issue-t a [GitHubon](https://github.com/enisz/bitbutler/issues) a **Bug Report** sablon használatával (vagy a **Feature Request** / **Enhancement** sablonnal, ha nem hibáról van szó).
