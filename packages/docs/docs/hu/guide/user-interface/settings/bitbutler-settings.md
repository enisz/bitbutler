---
title: BitButler beállítások
description: A BitButler alkalmazásszintű beállításainak konfigurálása - indítási viselkedés, megjelenés, szerverenkénti kapcsolati viselkedés, állapotsáv és torrenttáblázat.
---

# BitButler beállítások

A BitButler beállítások magát az alkalmazást szabályozzák: indítási viselkedés, megjelenés, szerverenkénti kapcsolati viselkedés, állapotsáv és torrenttáblázat. Ezeket a BitButler helyben tárolja, és függetlenek attól a qBittorrent-nox szervertől, amelyhez csatlakozol - a szerver saját beállításaiért lásd [qBittorrent beállítások](./qbittorrent-settings).

Nyisd meg a párbeszédablakot az eszköztárból: **Beállítások > BitButler**. A párbeszédablaknak négy füle van; egy mentetlen változtatásokkal rendelkező fül egy kis csillagot mutat a címkéje mellett. A változtatások az összes fülön együtt kerülnek mentésre a **Mentés** gombbal.

## Általános

![Általános fül](/screenshots/settings/bitbutler-settings/general.png)

### Indítás

| Beállítás                         | Leírás                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alkalmazás indítása a rendszerrel | Automatikusan elindítja a BitButlert az operációs rendszer indulásakor.                                                                                            |
| Kicsinyítve indítás               | Induláskor elrejti az alkalmazás ablakát; a BitButler továbbra is elérhető marad a rendszertálcáról. Az "Alkalmazás indítása a rendszerrel" bekapcsolását igényli. |

Ha az "Alkalmazás indítása a rendszerrel" be van kapcsolva, de nincs szerver alapértelmezett kapcsolatként megjelölve, itt egy figyelmeztető szöveg jelenik meg, amely emlékeztet, hogy az alkalmazás automatikus bejelentkezés nélkül fog elindulni. Lásd [Alapértelmezett szerver beállítása](../manage/servers#alapertelmezett-szerver-beallitasa).

### Viselkedés

| Beállítás                                                      | Leírás                                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Torrentfájlok törlése a listához adás után                     | Eltávolítja a helyi `.torrent` fájlt a lemezről, miután sikeresen hozzáadásra került a listához.                                                                                                                                                    |
| A torrent fájlok törlése, ha a torrent már szerepel a listában | Automatikusan eltávolítja a forrás `.torrent` fájlt a lemezről, ha az duplikátumként kerül újra hozzáadásra. A "Torrentfájlok törlése a listához adás után" bekapcsolását igényli - lásd a [Torrent már létezik ablakot](../torrent-exists-window). |
| Automatikus frissítések                                        | Az alkalmazás minden indulásakor automatikusan ellenőrzi a BitButler frissítéseit. Egy mellette lévő **Frissítések keresése most** gomb igény szerint indít ellenőrzést.                                                                            |
| Alkalmazáson belüli értesítés pozíciója                        | Hol jelenjenek meg a felugró értesítések: Bal felül, Jobb felül, Jobb alul vagy Bal alul.                                                                                                                                                           |

### Nyelv

Beállítja a felület nyelvét: **Angol** vagy **Magyar**. A módosítás azonnal frissíti a felületet, és újraépíti a tálca és az alkalmazásmenü címkéit is.

### Dátum és idő

| Beállítás        | Leírás                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dátumformátum    | Egy előre beállított minta: Nyelv szerint, ISO, USA, Európai vagy Egyéni.                                               |
| A hét első napja | Automatikus, Vasárnap, Hétfő vagy Szombat.                                                                              |
| Egyéni minta     | Csak akkor jelenik meg, ha a dátumformátum Egyéni. Egy szabadszöveges minta a lenti tokenekből építve, élő előnézettel. |

Kattints a **Jelölőútmutató** gombra a mintában használható tokenek táblázatának kibontásához (alapból összecsukva), lásd lentebb (a példaértékek egy 2026. április 5-i, keddi, 14:05:09 időpontra vonatkoznak):

| Token  | Leírás                | Példa   |
| ------ | --------------------- | ------- |
| `yyyy` | 4 jegyű év            | 2026    |
| `yy`   | 2 jegyű év            | 26      |
| `MMMM` | Teljes hónapnév       | április |
| `MMM`  | Rövidített hónapnév   | ápr.    |
| `MM`   | 2 jegyű hónap         | 04      |
| `M`    | Hónap száma           | 4       |
| `EEEE` | Teljes napnév         | kedd    |
| `EEE`  | Rövidített napnév     | k       |
| `dd`   | 2 jegyű nap           | 05      |
| `d`    | Nap                   | 5       |
| `HH`   | 2 jegyű óra (24 órás) | 14      |
| `H`    | Óra (24 órás)         | 14      |
| `hh`   | 2 jegyű óra (12 órás) | 02      |
| `h`    | Óra (12 órás)         | 2       |
| `mm`   | 2 jegyű perc          | 05      |
| `ss`   | 2 jegyű másodperc     | 09      |
| `a`    | DE/DU jelző           | DU      |

A szó szerinti szöveget egyszeres idézőjelbe tedd (pl. `'at'`), hogy változatlanul szerepeljen a mintában.

### Megjelenés

| Beállítás  | Leírás                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Témacsalád | Az általános színpaletta: BitButler, Aurora, Crimson Ember, Deep Sea, Mint Green, Ocean Breeze, Pumpkin Spice vagy Purple Haze. |
| Témamód    | Világos, Sötét vagy Rendszerszintű (követi az operációs rendszer témáját).                                                      |

### Mentésiútvonal-bevitel

Szabályozza, hogyan viselkedjenek a mentésiútvonal-mezők az egész alkalmazásban torrentek hozzáadásakor vagy áthelyezésekor:

- **ng-select** - egy legördülő, amelyet a csatlakoztatott szerveren talált mappák töltenek fel.
- **ngb-typeahead** - egy szabadszöveges mező, amely gépelés közben automatikus kiegészítési javaslatokat ad.

## Szerver

![Szerver fül](/screenshots/settings/bitbutler-settings/server.png)

Az Általános füllel ellentétben a Szerver beállítások **kapcsolatonként** kerülnek tárolásra - minden, a [Szerverek kezelésében](../manage/servers) hozzáadott szervernek saját lekérdezési intervalluma és útvonal-hozzárendelési konfigurációja van.

### Lekérdezés

A BitButler lekérdezi a qBittorrent webes API-t, hogy szinkronban tartsa a torrentlistát.

| Beállítás                          | Leírás                                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Előtérbeli lekérdezési intervallum | Milyen gyakran kérdezze le, amíg az alkalmazás ablaka nyitva van, 1 és 10 másodperc között.                                                                                      |
| Háttérbeli lekérdezési intervallum | Milyen gyakran kérdezze le, amíg az alkalmazás a rendszertálcára van kicsinyítve - állítsd magasabbra a hálózati forgalom csökkentéséhez, amíg az alkalmazás nincs a szem előtt. |

Ha bármelyik intervallumot 2 másodperc alá állítod, egy figyelmeztetés jelenik meg, mivel a túl agresszív lekérdezés problémákat okozhat.

### Útvonal-hozzárendelések

Ha egy szerver torrent-letöltési mappái helyben is csatolva vannak (például egy hálózati megosztás), a szerver távoli útvonalát a helyi megfelelőjéhez rendelheted. Ez lehetővé teszi, hogy a BitButler a megfelelő helyi mappát az operációs rendszer natív fájlböngészőjében nyissa meg a Torrent részletek nézetből, vagy a torrentlistából, amikor a [sorra dupla kattintás viselkedése](#tablazat-beallitasok) "Megjelenítés a mappában / Célhely megnyitása" értékre van állítva.

Minden sor egy **Távoli útvonalat** rendel egy **Helyi útvonalhoz**. Használd a **Hozzárendelés tesztelése** gombot annak megerősítéséhez, hogy egy hozzárendelés valódi helyi mappára oldódik fel, valamint a hozzáadás/eltávolítás gombokat minden sor mellett a lista kezeléséhez.

## Torrenttáblázat

![Torrenttáblázat fül](/screenshots/settings/bitbutler-settings/torrent-list-grid.png)

### Táblázat beállítások

| Beállítás                  | Leírás                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Sorok animálása            | Animálja a sorokat, amikor az értékeik megváltoznak. Kapcsold ki, ha teljesítményproblémákat tapasztalsz nagy listáknál.                       |
| Oldalszámozás              | Oldalakra bontja a torrentlistát ahelyett, hogy minden sort egyszerre renderelne - segít a teljesítményen nagyon nagy listáknál.               |
| Kompakt sorok              | Csökkenti a sormagasságot és a cellák kitöltését egy sűrűbb nézetért.                                                                          |
| Szüneteltetés modál esetén | Szünetelteti a háttérbeli lekérdezést, amíg bármely modális párbeszédablak nyitva van; a lekérdezés automatikusan folytatódik, amikor bezárul. |

A sorra dupla kattintás viselkedése szabályozza, mi történik egy torrentsorra való dupla kattintáskor:

- **Megjelenítés a mappában / Célhely megnyitása** - megnyitja a célmappát (és kijelöli a fájlt, egyfájlos torrentek esetén). Ehhez az adott szerverhez beállított [útvonal-hozzárendelések](#utvonal-hozzarendelesek) szükségesek.
- **Torrent részletek megnyitása** - megnyitja a Torrent részletek nézetet.
- **Helyszíni szerkesztés** - közvetlenül szerkeszthetővé teszi az erre alkalmas cellákat a táblázatban: dupla kattintás a szerkesztéshez, Enter a megerősítéshez, Escape a megszakításhoz. Csak azok az oszlopok szerkeszthetők, amelyek közvetlenül egy qBittorrent API mezőre épülnek (nincs számított/formázott érték).
- **Ne tegyen semmit** - letiltja a dupla kattintás műveletét.

### Oszlopok

- **Oszlopkészlet** - az összes elérhető oszlop kereshető, többszörös kiválasztású listája. A felette lévő **Visszaállítás** gomb visszaállítja a látható oszlopokat és sorrendjüket az alapértelmezettre.
- **Sorrend** - húzd az engedélyezett oszlopok átrendezéséhez; ez egyben a torrenttáblázatban balról jobbra megjelenő sorrend is. Minden sorhoz tartozik **Ugrás a lista tetejére**, **Mozgatás feljebb**, **Mozgatás lejjebb**, **Ugrás a lista aljára** és **Eltávolítás** gomb is, így húzás nélkül is átrendezheted vagy eltávolíthatod az oszlopot.

## Állapotsáv

![Állapotsáv fül](/screenshots/settings/bitbutler-settings/status-bar.png)

Konfiguráld a főablak alján lévő állapotsávban megjelenő widgetek láthatóságát és sorrendjét. Húzd a widgeteket az **Elérhető modulok** (letiltva/nem használt) és a **Bal** vagy **Jobb** oszlop között az engedélyezéshez, letiltáshoz vagy átrendezéshez. A widgetkészlet feletti **Visszaállítás alapértelmezettre** gomb visszaállítja az alapértelmezett widget-elrendezést.

Elérhető widgetek:

- Kapcsolat állapota
- DHT csomópontok
- Globális munkamenet arány
- Globális összesített arány
- Globális munkamenet letöltés
- Globális összesített letöltés
- Globális munkamenet feltöltés
- Globális összesített feltöltés
- Letöltési sebesség
- Feltöltési sebesség
- Lemezterület
- Munkamenet-statisztikák
- Kijelölés adatai
- Lekérdezés-jelző
