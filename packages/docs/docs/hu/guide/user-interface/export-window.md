---
title: Exportálás ablak
description: Torrentek exportálása a csatlakoztatott szerverről egy BitButler .bbe archívumba.
---

# Exportálás ablak

Az Exportálás ablak becsomagolja a jelenleg csatlakoztatott szerver torrentjeit - azok metaadatait, kategóriáit és címkéit - egyetlen `.bbe` archívumfájlba, amelyet később az [Importálás ablakkal](./import-window) állíthatsz vissza.

![Exportálás ablak kapcsolatadatokkal, exporthatókörrel és mentési hellyel](/screenshots/export-window/overview.png)

## Az Exportálás ablak megnyitása

Az exportálás az alkalmazás natív **Fájl** menüjéből érhető el: **Fájl > Torrentek exportálása** (**Ctrl+E** / **Cmd+E**). A menüpont csak akkor engedélyezett, ha a program csatlakozva van egy szerverhez.

## Kapcsolat adatai

A párbeszédablak teteje csak olvasható adatokat mutat arról a szerverről, amelyről exportálsz: a nevét, URL-jét, WebUI API-verzióját és qBittorrent-verzióját. Emellett megjeleníti az **Exporttípust** is:

- **Teljes exportálás** - a qBittorrent exportvégpontja észlelve lett. Az archívum minden torrent tényleges `.torrent` fájlját beágyazza, így importáláskor minden mező teljesen visszaállítható.
- **Örökölt (legacy) exportálás** - a végpont nem lett észlelve. Csak mágneslinkek kerülnek mentésre; a fájlátnevezések és a fájlonkénti prioritások nem állíthatók vissza, mivel a mágneslinkek nem hordoznak fájlstruktúra-információt.

Maga az archívum nem tartalmazza a szerver kapcsolati adatait vagy hitelesítő adatait - csak a szerver nevét és egy belső azonosítót, referenciaként. A visszaállításhoz importáláskor akkor is saját kezűleg kell kiválasztanod egy célszervert.

## Az exportálandó tartalom kiválasztása

Három egymástól független hatókör-választó szabályozza, mi kerül az archívumba, mindegyik élő számlálóval:

- **Torrentek** - **Összes**, **Szűrt** (amire az oldalsáv/keresés szűrői jelenleg leszűkítik a listát), vagy **Kijelölt**.
- **Kategóriák** - **Összes** kategória, vagy csak az exportálandó torrentekhez ténylegesen **hozzárendelt** kategóriák.
- **Címkék** - **Összes** címke, vagy csak az exportálandó torrentekhez ténylegesen **hozzárendelt** címkék.

## Mentési hely

Kattints a **Tallózás** gombra (vagy magára a célmezőre) egy mappa kiválasztásához a natív fájlválasztóval; alapértelmezés szerint a Letöltések mappát ajánlja fel. A fájlnév mező alapértelmezetten `<szervernév>-<éééhhnn>` formátumú, és mindig `.bbe` kiterjesztést kap.

## Exportálás folyamata

Az **Exportálás** gombra kattintva a párbeszédablak folyamatnézetre vált: egy sáv és egy futó számláló (`jelenlegi / összes`) követi az egyes torrentek lekérdezését, alatta az éppen feldolgozás alatt álló torrenttel. Amikor végzett, egy sikerüzenet jelenik meg - megjegyezve, hány torrent lett kihagyva, ha volt ilyen -, valamint egy **Megjelenítés a mappában** gomb az archívum felfedéséhez. Az exportálás futása közben **Mégse** választható; hiba esetén egy soron belüli hibaüzenet jelenik meg helyette.
