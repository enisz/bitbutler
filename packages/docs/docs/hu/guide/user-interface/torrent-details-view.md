---
title: Torrent részletek nézet
description: A Torrent részletek párbeszédablak - Általános, Trackerek, Peerek és Tartalom fülek, valamint a lábléc műveletei.
---

# Torrent részletek nézet

A Torrent részletek párbeszédablak egy teljes, fülekre bontott áttekintést ad egyetlen torrentről: a metaadatait és átviteli statisztikáit, trackereit, csatlakozott peerjeit és fájltartalmát.

![Torrent details view placeholder](https://placehold.co/600x400/31343C/EEE?text=Torrent+Details)

## Torrent részleteinek megnyitása

Egy torrentsorra való dupla kattintás alapból megnyitja ezt a párbeszédablakot - lásd [Sorra dupla kattintás viselkedése](./settings/bitbutler-settings#tablazat-beallitasok) ennek megváltoztatásához vagy letiltásához. Jobb gombbal is kattinthatsz egyetlen torrentsorra, és kiválaszthatod a **Torrent részletek** lehetőséget a helyi menüből (ez az opció nem érhető el, ha több sor van kijelölve).

## Általános

Az Általános fül három csoportra oszlik:

- **Általános** - név, mentési útvonal, távoli (szerveroldali) útvonal, helyi útvonal (csak akkor jelenik meg, ha egy [útvonal-hozzárendelés](./settings/bitbutler-settings#utvonal-hozzarendelesek) feloldja azt), Automatikus torrentkezelés és Kényszerített indítás jelzők, jelenlegi állapot, státusz és bármely hibaüzenet.
- **Átvitel** - aktív idő, várható hátralévő idő, kapcsolatok, letöltött/feltöltött összesen, seedek/peerek (csatlakozott vs. összes ismert), letöltési/feltöltési sebesség és korlátok, kárba veszett adat, megosztási arány, idő a következő újrajelentkezésig, utoljára teljesnek látva, arány- és seedelésiidő-korlátok, valamint a szekvenciális letöltés / első-utolsó szelet prioritás / super seeding jelzők.
- **Információ** - teljes méret, szeletek száma (azzal, hogy hányat birtokolsz), készítő és létrehozás dátuma, hozzáadás és befejezés dátuma, mind a v1, mind a v2 info hash, valamint a torrent megjegyzése.

A legtöbb szövegmező mellett egy kis vágólapra másoló gomb található.

## Trackerek

A torrent összes trackerének rendezhető, szűrhető táblázata: szint, URL, státusz (Letiltva, Nincs kapcsolatfelvétel, Működik, Frissítés, vagy Nem működik), valamint peer/seed/leech/letöltés számai, plusz bármely státuszüzenet a trackertől. Kattints jobb gombbal egy sorra az URL, a cellaérték, vagy a teljes sor JSON-ként való másolásához. Az oszlopok sorrendje, szélessége és rendezése munkamenetek között megőrződik.

## Peerek

A torrenthez éppen csatlakozó összes peer rendezhető, szűrhető táblázata: ország, IP és port, kapcsolattípus, protokolljelzők (mutasd az egérrel egy jelzőre a jelentéséért), kliens neve, peerenkénti állapot, letöltési/feltöltési sebesség, letöltött/feltöltött összesen, relevancia, valamint hogy az adott peernek mely fájljai vannak meg. Kattints jobb gombbal egy sorra az IP:port, a cellaérték, vagy a sor JSON-ként való másolásához.

## Tartalom

A torrent tartalmának kibontható fájlfa. Minden fájlhoz tartozik egy jelölőnégyzet a letöltésbe való bevonáshoz vagy kizáráshoz, valamint egy prioritás-legördülő (Normál, Magas vagy Maximális, a kizárt/kihagyott mellett), a saját folyamatsávjával együtt. A szerkesztés szerkesztő módba kapcsolja a fület - egy kis csillaggal jelölve a Tartalom fülön -, amíg el nem mented a változtatásokat.

## Lábléc műveletei

Egy önálló **Törlés** gomb eltávolítja a torrentet. A lábléc többi része legördülő menükbe csoportosítja a kapcsolódó műveleteket:

- **Vezérlés** - Folytatás, Szüneteltetés, Kényszerített folytatás.
- **Fájlok** - Fájl megjelenítése / Célhely megnyitása (letiltva, amíg egy [útvonal-hozzárendelés](./settings/bitbutler-settings#utvonal-hozzarendelesek) fel nem old egy helyi mappát), Mentési útvonal beállítása, Letöltési útvonal beállítása, valamint Torrentfájl exportálása.
- **Kezelés** - Átnevezés, Kategória módosítása, Címkék módosítása.
- **Átvitel** - Átviteli korlátok, Megosztási korlátok szerkesztése, valamint kapcsolók a Super Seedinghez, a Szekvenciális letöltéshez és az Első/utolsó szelet prioritáshoz.
- **Karbantartás** - Kényszerített ellenőrzés, Kényszerített újrajelentkezés, valamint egy kapcsoló az Automatikus torrentkezeléshez.

A jobb szélen egy **Bezárás** gomb zárja be a párbeszédablakot.
