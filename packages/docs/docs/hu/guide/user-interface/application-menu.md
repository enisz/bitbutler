---
title: Alkalmazásmenü
description: A natív Fájl, Szerverek, Beállítások és Súgó menük, valamint azok billentyűparancsai.
---

# Alkalmazásmenü

A BitButler az alkalmazáson belüli eszköztár mellett natív operációs rendszer szintű menüsávval is rendelkezik. Néhány művelet - a kijelentkezés, a kilépés, a frissítések keresése - csak innen érhető el.

## Fájl

| Elem                  | Billentyűparancs | Megjegyzés                                                                                    |
| --------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Torrent hozzáadása    | `Ctrl+N`         | Megnyitja a [Torrent hozzáadása](../managing-torrents#torrentek-hozzaadasa) párbeszédablakot. |
| Torrentek exportálása | `Ctrl+E`         | Megnyitja az [Exportálás ablakot](./export-window).                                           |
| Torrentek importálása | `Ctrl+I`         | Megnyitja az [Importálás ablakot](./import-window).                                           |
| Kijelentkezés         | `Ctrl+L`         | Kijelentkezik az aktuális szerverről, és visszatér a [Bejelentkezési oldalra](./login-page).  |
| Kilépés               | `Ctrl+Q`         | Teljesen bezárja a BitButlert.                                                                |

A Torrent hozzáadása, Torrentek exportálása, Torrentek importálása és Kijelentkezés elemek csak akkor engedélyezettek, ha a program csatlakozva van egy szerverhez.

## Szerverek

Csak csatlakoztatott állapotban jelenik meg, és csak akkor, ha legalább egy szerver van beállítva: egy rádiógombos lista az összes szerverről, az aktuálisan bejelölttel. Egy másik kiválasztása azonnal átvált arra, ugyanúgy, mint az eszköztár szerver-legördülőjének használata. Ha ahhoz a szerverhez nincs mentett felhasználónév vagy jelszó, előbb egy hitelesítő adat kérő ablak jelenik meg, azzal a lehetőséggel, hogy a megadottakat elmentse a következő alkalomra.

## Beállítások

Csak csatlakoztatott állapotban jelenik meg:

| Elem                    | Billentyűparancs | Megjegyzés                                                       |
| ----------------------- | ---------------- | ---------------------------------------------------------------- |
| BitButler beállítások   | `Ctrl+.`         | Lásd [BitButler beállítások](./settings/bitbutler-settings).     |
| qBittorrent beállítások | `Ctrl+,`         | Lásd [qBittorrent beállítások](./settings/qbittorrent-settings). |
| Szerverek kezelése      | `Ctrl+Shift+S`   | Lásd [Kezelés > Szerverek](./manage/servers).                    |
| Címkék kezelése         | `Ctrl+Shift+T`   | Lásd [Kezelés > Címkék](./manage/tags).                          |
| Kategóriák kezelése     | `Ctrl+Shift+C`   | Lásd [Kezelés > Kategóriák](./manage/categories).                |

## Súgó

| Elem                   | Billentyűparancs | Megjegyzés                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frissítések keresése   | `Ctrl+U`         | Manuálisan ellenőrzi, hogy van-e új BitButler verzió - ugyanaz az ellenőrzés, amely induláskor automatikusan lefut, ha az "Automatikus frissítések" bekapcsolva van a [BitButler beállítások > Indítás](./settings/bitbutler-settings#inditas) alatt. Ha van újabb verzió, megnyílik a [Frissítés elérhető ablak](./update-available-window). |
| Felhasználói kézikönyv | `Ctrl+Shift+,`   | Megnyitja ezt a dokumentációs oldalt az alapértelmezett böngésződben, az alkalmazás jelenlegi nyelvén.                                                                                                                                                                                                                                        |
| A BitButlerről         | `F1`             | Megjeleníti az alkalmazás verzióját és a kapcsolódó információkat.                                                                                                                                                                                                                                                                            |

Windowson a `Ctrl` a fent látható módosítóbillentyű; más platformokon ugyanezek a gyorsbillentyűk érvényesek az adott platform szokásos parancsbillentyűjével. Nincs külön macOS alkalmazásnév-menü - **A BitButlerről** és a **Kilépés** minden platformon a **Súgó**, illetve a **Fájl** alatt marad, ahogy fent is látható; macOS-en a **Kilépés** feliratát az operációs rendszer generálja, ezért az angol "Quit BitButler" formában jelenik meg, a program nyelvi beállításától függetlenül.
