---
title: Billentyűparancsok
description: A BitButlerben elérhető globális, menü- és torrenttáblázat-billentyűparancsok.
---

# Billentyűparancsok

Ezek a billentyűparancsok a főablakban aktívak. Szövegmezőbe gépelés közben, valamint bármely párbeszédablak nyitva léte alatt le vannak tiltva (kivéve, ahol ez külön jelezve van).

## Globális billentyűparancsok

| Billentyűparancs | Művelet                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Ctrl+K`         | Az eszköztár keresőmezőjére fókuszál.                                                                                                                                                                                                                                    |
| `Escape`         | Amíg a keresőmező fókuszban van, üríti azt. Egyébként bezárja az éppen nyitva lévő párbeszédablakot (kivéve a Torrent hozzáadása ablakot, amelyet csak a Mégse/bezárás gombbal lehet bezárni).                                                                           |
| `Delete`         | Törli a kijelölt torrente(ke)t. Tartsd lenyomva a `Shift`-et, hogy a megerősítő párbeszédablak "fájlok törlése is" opciója alapból be legyen jelölve. A táblázat többi billentyűparancsával ellentétben ez akkor is aktív marad, ha egy másik párbeszédablak nyitva van. |

## Menü billentyűparancsok

Ezek a natív [Alkalmazásmenüből](./user-interface/application-menu) származnak, és néhány platformon akkor is működnek, ha az ablak nincs fókuszban, mivel operációs rendszer szinten vannak regisztrálva, nem a renderelő folyamatban:

| Billentyűparancs | Művelet                 |
| ---------------- | ----------------------- |
| `Ctrl+N`         | Torrent hozzáadása      |
| `Ctrl+E`         | Torrentek exportálása   |
| `Ctrl+I`         | Torrentek importálása   |
| `Ctrl+L`         | Kijelentkezés           |
| `Ctrl+Q`         | Kilépés                 |
| `Ctrl+.`         | BitButler beállítások   |
| `Ctrl+,`         | qBittorrent beállítások |
| `Ctrl+Shift+S`   | Szerverek kezelése      |
| `Ctrl+Shift+T`   | Címkék kezelése         |
| `Ctrl+Shift+C`   | Kategóriák kezelése     |
| `Ctrl+U`         | Frissítések keresése    |
| `Ctrl+Shift+,`   | Felhasználói kézikönyv  |
| `F1`             | A BitButlerről          |

Ezek közül mindegyik, a Kilépés, a Frissítések keresése, A BitButlerről és a Felhasználói kézikönyv kivételével, csak akkor működik, ha a program csatlakozva van egy szerverhez. Lásd [Alkalmazásmenü](./user-interface/application-menu) a teljes menüszerkezetért, amelyhez ezek tartoznak.

## Táblázat billentyűparancsok

A többi közvetlenül a torrenttáblázatra vonatkozik, és le van tiltva, amíg bármely párbeszédablak nyitva van.

### Kijelölés

| Billentyűparancs                    | Művelet                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `Ctrl+A`                            | Kijelöli az összes jelenleg látható torrentet (az aktív szűrők figyelembevételével). |
| `Shift` + navigációs billentyű      | Kiterjeszti az aktuális kijelölést a horgony sortól az új pozícióig.                 |
| `Shift+Ctrl` + navigációs billentyű | Kiterjeszti a kijelölést anélkül, hogy törölné a tartományon kívül kijelölt sorokat. |

### Navigáció

| Billentyűparancs        | Művelet                                               |
| ----------------------- | ----------------------------------------------------- |
| `Fel nyíl` / `Le nyíl`  | A fókuszt a fenti vagy alatti sorra mozgatja.         |
| `Home` / `End`          | Az első vagy utolsó sorra ugrik.                      |
| `Page Up` / `Page Down` | A fókuszt körülbelül egy képernyőnyi sorral mozgatja. |

A fókusz `Shift` nélküli mozgatása egyben az aktuális kijelölést is lecseréli az újonnan fókuszált sorra, hacsak nem tartod lenyomva a `Ctrl`-t, amely esetben a fókusz a kijelölés megváltoztatása nélkül mozog. A soron belüli szerkesztést támogató cellára való dupla kattintás, valamint az `Enter`/`Escape` billentyűk a megerősítéshez vagy elvetéshez az alapul szolgáló táblázatkezelő könyvtár szokásos szerkesztési viselkedését követik, nem a BitButler egyedi testreszabását.
