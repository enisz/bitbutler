---
title: Torrent hozzáadása ablak
description: Részletes útmutató a Torrent hozzáadása ablak felületéhez és füleihez.
---

# Torrent hozzáadása ablak

A Torrent hozzáadása párbeszédablak lehetővé teszi új torrentek hozzáadását a qBittorrent szerveredhez. Több fülből áll, amelyek különböző szintű vezérlést biztosítanak a hozzáadott torrentek felett.

## Általános fül

![Torrent hozzáadása ablak - Általános fül fájl bevitellel](/screenshots/add-torrent-dialog/add-torrent-general-file.png)

Az **Általános** fülön adhatod meg, hogy mit szeretnél hozzáadni - egy `.torrent` fájlt, egy mappát, vagy mágneslinkeket.

### Hozzáadás mappából

![Torrent hozzáadása ablak - Általános fül mappa bevitellel](/screenshots/add-torrent-dialog/add-torrent-general-folder.png)

Torrenteket közvetlenül egy mappából is hozzáadhatsz a bemeneti mód "Mappa" opciójának kiválasztásával. Ez átvizsgálja a kiválasztott könyvtárat `.torrent` fájlok után, és egy táblázatban listázza őket; kapcsold be a **Rekurzív** opciót (alapból kikapcsolva), hogy az alkönyvtárakat is átvizsgálja. A szerveren már létező torrenteknek megfelelő fájlok "Létezik" jelöléssel kerülnek megjelenítésre, és ki vannak zárva a kiválasztásból - csak a bejelölt sorok kerülnek hozzáadásra a **Hozzáadás** gombra kattintáskor.

### Hozzáadás fájlból

Kattints a **Tallózás** gombra egy `.torrent` fájl kiválasztásához (vagy húzz egyet közvetlenül a mezőre). Kiválasztás után a BitButler megmutatja a torrent teljes méretét a célhelyen elérhető szabad hely mellett. Opcionálisan nevezd át, majd állíts be mentési útvonalat, kategóriát és címkéket a **Hozzáadás** gombra kattintás előtt.

### Hozzáadás mágneslinkből

![Torrent hozzáadása ablak - Általános fül mágneslink bevitellel](/screenshots/add-torrent-dialog/add-torrent-general-link.png)

Váltsd a bemeneti módot **Link**-re, és illessz be egy vagy több mágneslinket a szövegmezőbe, soronként egyet. Fájlhoz hasonlóan itt is beállíthatsz mentési útvonalat, kategóriát és címkéket a hozzáadás előtt - a Fájlok fül mágneslinkek esetén nem elérhető, mivel egy mágneslinknek nincs fájllistája, amíg a metaadatait a hozzáadás után le nem kérdezi.

## Fájlok fül

![Torrent hozzáadása ablak - Fájlok fül](/screenshots/add-torrent-dialog/add-torrent-files.png)

A **Fájlok** fül csak akkor válik elérhetővé, amikor egyetlen `.torrent` fájlt töltöttél be, és fastruktúrában mutatja a torrentben található fájlokat. Kiválaszthatod vagy kihagyhatod az egyes fájlokat a letöltésből, valamint beállíthatod a prioritásukat. Mágneslinkek és mappa módú (több torrentes) hozzáadás esetén nem elérhető.

## Beállítások fül

![Torrent hozzáadása ablak - Beállítások fül](/screenshots/add-torrent-dialog/add-torrent-options.png)

A **Beállítások** fülön torrentenkénti viselkedést állíthatsz be. Minden beállítás megmarad alapértelmezettként a következő hozzáadott torrenthez.

- **Gyökérmappa** - meghatározza, hogyan kezelje a több fájlos torrent felső szintű mappáját: az **Alapértelmezett** a qBittorrent saját globális beállítására hagyja, a **Gyökérmappa létrehozása** mindig egy mappába csomagolja a fájlokat, a **Ne hozzon létre gyökérmappát** pedig mappa nélkül, lapos szerkezetben tölti le őket.
- **Hash-ellenőrzés kihagyása** - megbízik a mentési útvonalon már meglévő adatokban, és nem futtatja le a qBittorrent ellenőrzését indítás előtt.
- **Hozzáadás felfüggesztett állapotban** - sorba állítja a torrentet anélkül, hogy azonnal elindítaná.
- **Automatikus Torrentkezelés (TMM) használata** - bekapcsolja az Automatikus torrentkezelést, így a qBittorrent a torrent kategóriájából származtatja a mentési útvonalat az Általános fülön beállított útvonal helyett (amely továbbra is elküldésre kerül, de csak akkor veszi figyelembe a szerver, ha ez ki van kapcsolva).
- **Sorrendi letöltés engedélyezése** - a darabokat fájlsorrendben tölti le a qBittorrent alapértelmezett "legritkább előbb" stratégiája helyett.
- **Első és utolsó szelet priorizálása** - minden fájl első és utolsó darabját a többi elé sorolja, a sorrendi letöltéstől függetlenül.

## Korlátok fül

![Torrent hozzáadása ablak - Korlátok fül](/screenshots/add-torrent-dialog/add-torrent-limits.png)

A **Korlátok** fülön átviteli sebességkorlátokat (letöltési/feltöltési sebesség) és megosztási korlátokat (arány és seedelési idő) állíthatsz be a torrenthez.
