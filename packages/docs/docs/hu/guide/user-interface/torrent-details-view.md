---
title: Torrent részletek nézet
description: A Torrent részletek párbeszédablak - Általános, Trackerek, Peerek és Tartalom fülek, valamint a lábléc műveletei.
---

# Torrent részletek nézet

A Torrent részletek párbeszédablak egy teljes, fülekre bontott áttekintést ad egyetlen torrentről: a metaadatait és átviteli statisztikáit, trackereit, csatlakozott peerjeit és fájltartalmát.

## Torrent részleteinek megnyitása

Egy torrentsorra való dupla kattintás alapból megnyitja ezt a párbeszédablakot - lásd [Sorra dupla kattintás viselkedése](./settings/bitbutler-settings#tablazat-beallitasok) ennek megváltoztatásához vagy letiltásához. Jobb gombbal is kattinthatsz egyetlen torrentsorra, és kiválaszthatod a **Torrent részletek** lehetőséget a helyi menüből (ez az opció nem érhető el, ha több sor van kijelölve). Lásd [Torrenttáblázat nézet > Helyi menü](./torrent-list-view#helyi-menu) ehhez a menühöz.

## Általános

![Általános fül](/screenshots/torrent-details-view/general.png)

A fül tetején egy folyamatsáv és egy színes állapotjelző látható, alattuk egy hibasávval, amikor a qBittorrent hibát jelent a torrenthez. Ez alatt a fül négy csoportra oszlik:

- **Torrent** - név, mentési útvonal, távoli (szerveroldali) útvonal, valamint helyi útvonal (csak akkor jelenik meg, ha egy [útvonal-hozzárendelés](./settings/bitbutler-settings#utvonal-hozzarendelesek) feloldja azt).
- **Opciók** - élő kapcsolók, amelyek a bekapcsolásuk pillanatában közvetlenül hívják a qBittorrentet, a lábléc [Átvitel és Karbantartás](#lablec-muveletei) legördülőitől függetlenül. Egyikük sem vált azonnal - mindegyik a következő torrentadat-frissítéskor mutatja a megerősített állapotot, illetve hibaüzenetet jelez (a kapcsolót változatlanul hagyva), ha a hívás sikertelen.
  - **Auto TMM** - a mentési útvonal kezelését a torrent kategóriájára bízza (Automatikus torrentkezelés).
  - **Szekvenciális letöltés** - a szeleteket fájlsorrendben tölti le a qBittorrent alapértelmezett "legritkább előbb" stratégiája helyett.
  - **Kényszerített indítás** - megkerüli a sorlimitet, így a torrent a sorban elfoglalt helyétől függetlenül elindul.
  - **Super Seeding** - bekapcsolja a super seeding feltöltési stratégiát; csak seedelés közben hasznos.
  - **Első/utolsó szelet prioritása** - minden fájl első és utolsó szeletét a többi elé sorolja, gyorsabb médiaelőnézetért.
- **Átvitel** - aktív idő, várható hátralévő idő, kapcsolatok, letöltött/feltöltött összesen, seedek/peerek (csatlakozott vs. összes ismert), letöltési/feltöltési sebesség és korlátok, kárba veszett adat, megosztási arány, idő a következő újrajelentkezésig, utoljára teljesnek látva, valamint arány- és seedelésiidő-korlátok.
- **Információ** - teljes méret, szeletek száma (azzal, hogy hányat birtokolsz), készítő és létrehozás dátuma, hozzáadás és befejezés dátuma, mind a v1, mind a v2 info hash, valamint a torrent megjegyzése.

A legtöbb szövegmező mellett egy kis vágólapra másoló gomb található.

## Trackerek

![Trackerek fül](/screenshots/torrent-details-view/trackers.png)

A torrent összes trackerének rendezhető, szűrhető táblázata: szint, URL, státusz (Letiltva, Nincs kapcsolatfelvétel, Működik, Frissítés, vagy Nem működik), valamint peer/seed/leech/letöltés számai, plusz bármely státuszüzenet a trackertől. Kattints jobb gombbal egy sorra az URL, a cellaérték, vagy a teljes sor JSON-ként való másolásához. Az oszlopok sorrendje, szélessége és rendezése munkamenetek között megőrződik.

## Peerek

![Peerek fül](/screenshots/torrent-details-view/peers.png)

A torrenthez éppen csatlakozó összes peer rendezhető, szűrhető táblázata: ország, IP és port, kapcsolattípus, protokolljelzők (mutasd az egérrel egy jelzőre a jelentéséért), kliens neve, peerenkénti állapot, letöltési/feltöltési sebesség, letöltött/feltöltött összesen, relevancia, valamint hogy az adott peernek mely fájljai vannak meg. Kattints jobb gombbal egy sorra az IP:port, a cellaérték, vagy a sor JSON-ként való másolásához.

## Tartalom

![Tartalom fül](/screenshots/torrent-details-view/content.png)

A torrent tartalmának kibontható fájlfa. Minden fájlhoz tartozik egy jelölőnégyzet a letöltésbe való bevonáshoz vagy kizáráshoz, valamint egy prioritás-legördülő (Normál, Magas vagy Maximális, a kizárt/kihagyott mellett), a saját folyamatsávjával együtt. A szerkesztés szerkesztő módba kapcsolja a fület - egy kis csillaggal jelölve a Tartalom fülön -, amíg el nem mented a változtatásokat.

## Lábléc műveletei

![Lábléc műveletei](/screenshots/torrent-details-view/footer-actions.png)

Egy önálló **Törlés** gomb eltávolítja a torrentet. A lábléc többi része legördülő menükbe csoportosítja a kapcsolódó műveleteket; az itt korábban megtalálható Auto TMM, Szekvenciális letöltés, Super Seeding és Első/utolsó szelet prioritás kapcsolók átkerültek az Általános fül [Opciók csoportjába](#altalanos):

- **Vezérlés** - Folytatás, Szüneteltetés, Kényszerített folytatás.
- **Fájlok** - Fájl megjelenítése / Célhely megnyitása (letiltva, amíg egy [útvonal-hozzárendelés](./settings/bitbutler-settings#utvonal-hozzarendelesek) fel nem old egy helyi mappát), Mentési útvonal beállítása, Letöltési útvonal beállítása, valamint Torrentfájl exportálása.
- **Kezelés** - Átnevezés, Kategória módosítása, Címkék módosítása.
- **Átvitel** - Átviteli korlátok és Megosztási korlátok.
- **Karbantartás** - Kényszerített ellenőrzés és Kényszerített újrajelentkezés.

A jobb szélen egy **Bezárás** gomb zárja be a párbeszédablakot.
