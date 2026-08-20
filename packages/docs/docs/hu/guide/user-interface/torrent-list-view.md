---
title: Torrentlista nézet
description: A főablak bemutatása - eszköztár, oldalsáv szűrők, keresés, torrenttáblázat és állapotsáv.
---

# Torrentlista nézet

![Torrentlista nézet eszköztárral, oldalsáv szűrőkkel, torrenttáblázattal és állapotsávval](/screenshots/torrent-list-view/overview.png)

A főablak az, ahol a legtöbb időt töltöd a BitButlerben. Egy eszköztár fut végig a tetején, egy szűrő oldalsáv a bal oldalon helyezkedik el, a torrenttáblázat kitölti a középső részt, egy állapotsáv pedig végigfut az alján.

## Eszköztár

Balról jobbra haladva az eszköztár aszerint csoportosítja a műveleteket, hogy mire hatnak:

- **Hozzáadás** - megnyitja a Torrent hozzáadása párbeszédablakot.
- **Törlés** - eltávolítja a kijelölt torrente(ke)t. Tartsd lenyomva a **Shift**-et kattintás közben, hogy a megerősítő párbeszédablak "fájlok törlése is" opciója alapból be legyen jelölve.
- **Indítás** / **Leállítás** - folytatja vagy szünetelteti a kijelölt torrente(ke)t.
- **Összes indítása** / **Összes leállítása** - folytatja vagy szünetelteti az összes torrentet, a kijelöléstől függetlenül.
- **Legfelülre** / **Fel** / **Le** / **Legalulra** - mozgatja a kijelölt torrente(ke)t a letöltési sorrenden belül.
- **Beállítások** - egy legördülő a **BitButler beállítások** és **qBittorrent beállítások** eléréséhez.
- **Kezelés** - egy legördülő a **Kezelés > Szerverek**, **Kezelés > Címkék** és **Kezelés > Kategóriák** eléréséhez.

A kijelölést igénylő gombok (Törlés, Indítás, Leállítás és a sorrend-átrendező gombok) letiltva vannak, ha nincs kijelölve torrent; az **Összes indítása** és **Összes leállítása** csak akkor tiltott, ha a lista üres.

A jobb oldali keresőmező gépelés közben szűri a táblázatot, kicsit késleltetve, hogy ne szűrjön minden billentyűleütésnél. Nyomd meg a **Ctrl+K**-t az ablak bármely pontjáról az odaugráshoz, a kis **x** gomb (vagy fókusz közben az **Escape**) pedig üríti azt.

## Helyi menü

![Torrenttáblázat jobb kattintásos helyi menüje](/screenshots/torrent-list-view/context-menu.png)

Egy torrentsorra jobb gombbal kattintva megnyílik ez a menü. A jobb oldali jelzéssel ellátott elemek mutatják a [billentyűparancsukat](../keyboard-shortcuts#vezerles).

<pre>
Indítás                                                            F3
Leállítás                                                          F4
Kényszerített folytatás                                    Shift + F3
---------------------------------------------------------------------
Torrent részletei
---------------------------------------------------------------------
Fájlok                                                              ›
  Megjelenítés mappában / Célmappa megnyitása
  Mentési útvonal beállítása
  Letöltési útvonal beállítása
  Fájlok átnevezése
  Exportálás .torrent fájl(ok)ba
Kezelés                                                             ›
  Torrent átnevezése                                               F2
  Kategória beállítása
  Címkék beállítása
Sor                                                                 ›
  Mozgatás legfelülre
  Mozgatás feljebb
  Mozgatás lejjebb
  Mozgatás legalulra
Átvitel                                                             ›
  Átviteli korlát
  Megosztási korlát
  Super seeding engedélyezése/tiltása
  Szekvenciális letöltés engedélyezése/letiltása
  Első/utolsó szelet prioritás engedélyezése/letiltása
Karbantartás                                                        ›
  Kényszerített ellenőrzés
  Kényszerített újrajelentkezés
  Auto TMM be/kikapcsolása
Másolás                                                             ›
  Cella értékének másolása
  Név(ek) másolása
  Magnet link(ek) másolása
  Info hash(-ek) másolása
  Mentési útvonal(ak) másolása
  Másolás JSON-ként
Sor rögzítése                                                       ›
  Rögzítés felülre
  Rögzítés alulra
  Rögzítés feloldása
---------------------------------------------------------------------
Eltávolítás                                             (Shift +) Del
</pre>

Az **Egyedi** műveletek csak akkor jelennek meg, ha pontosan egy sor van kijelölve; a **Több** műveletek bármennyi kijelölt sorral működnek (eggyel is).

| Művelet                                              | Menü          | Egyedi | Több | Leírás                                                                                                                    |
| ---------------------------------------------------- | ------------- | :----: | :--: | ------------------------------------------------------------------------------------------------------------------------- |
| Indítás                                              | -             |   ✓    |  ✓   | Folytatja a kijelölt torrente(ke)t.                                                                                       |
| Leállítás                                            | -             |   ✓    |  ✓   | Szünetelteti a kijelölt torrente(ke)t.                                                                                    |
| Kényszerített folytatás                              | -             |   ✓    |  ✓   | Kényszerítve folytatja a kijelölt torrente(ke)t, figyelmen kívül hagyva a sorrendi korlátokat.                            |
| [Torrent részletei](./torrent-details-view)          | -             |   ✓    |      | Megnyitja a Torrent részletei párbeszédablakot a sorhoz.                                                                  |
| Megjelenítés mappában / Célmappa megnyitása          | Fájlok        |   ✓    |      | Megjeleníti a torrent fájlját, vagy megnyitja a mappáját, ha több fájlja van.                                             |
| Mentési útvonal beállítása                           | Fájlok        |   ✓    |  ✓   | Módosítja, hova mentik az adatokat a kijelölt torrente(k).                                                                |
| Letöltési útvonal beállítása                         | Fájlok        |   ✓    |  ✓   | Módosítja a befejezetlen letöltések útvonalát a kijelölt torrente(k)hez.                                                  |
| Fájlok átnevezése                                    | Fájlok        |   ✓    |      | Megnyitja a fájl-átnevezési párbeszédablakot a torrenthez.                                                                |
| Exportálás .torrent fájl(ok)ba                       | Fájlok        |   ✓    |  ✓   | Exportálja a kijelölt torrente(ke)t .torrent fájl(ok)ként.                                                                |
| Torrent átnevezése                                   | Kezelés       |   ✓    |      | Átnevezi a torrentet.                                                                                                     |
| Kategória beállítása                                 | Kezelés       |   ✓    |  ✓   | Kategóriát rendel a kijelölt torrente(k)hez.                                                                              |
| Címkék beállítása                                    | Kezelés       |   ✓    |  ✓   | Címkéket rendel a kijelölt torrente(k)hez.                                                                                |
| Mozgatás legfelülre                                  | Sor           |   ✓    |  ✓   | A letöltési sor tetejére mozgatja a kijelölt torrente(ke)t.                                                               |
| Mozgatás feljebb                                     | Sor           |   ✓    |  ✓   | Egy pozícióval feljebb mozgatja a kijelölt torrente(ke)t.                                                                 |
| Mozgatás lejjebb                                     | Sor           |   ✓    |  ✓   | Egy pozícióval lejjebb mozgatja a kijelölt torrente(ke)t.                                                                 |
| Mozgatás legalulra                                   | Sor           |   ✓    |  ✓   | A sor aljára mozgatja a kijelölt torrente(ke)t.                                                                           |
| Átviteli korlát                                      | Átvitel       |   ✓    |  ✓   | Torrentenkénti fel-/letöltési sebességkorlátokat állít be.                                                                |
| Megosztási korlát                                    | Átvitel       |   ✓    |  ✓   | Arány- és seedelésiidő-korlátokat állít be.                                                                               |
| Super seeding engedélyezése/tiltása                  | Átvitel       |   ✓    |  ✓   | Be- vagy kikapcsolja a super seedinget.                                                                                   |
| Szekvenciális letöltés engedélyezése/letiltása       | Átvitel       |   ✓    |  ✓   | Be- vagy kikapcsolja a szekvenciális letöltést.                                                                           |
| Első/utolsó szelet prioritás engedélyezése/letiltása | Átvitel       |   ✓    |  ✓   | Be- vagy kikapcsolja az első/utolsó szelet prioritást.                                                                    |
| Kényszerített ellenőrzés                             | Karbantartás  |   ✓    |  ✓   | Ellenőrzi a lemezen lévő letöltött adatokat.                                                                              |
| Kényszerített újrajelentkezés                        | Karbantartás  |   ✓    |  ✓   | Azonnal újrajelentkezik a trackereknél.                                                                                   |
| Auto TMM be/kikapcsolása                             | Karbantartás  |   ✓    |  ✓   | Be- vagy kikapcsolja az Automatikus torrentkezelést.                                                                      |
| Cella értékének másolása                             | Másolás       |   ✓    |  ✓   | A vágólapra másolja a jobb kattintással kijelölt cella nyers értékét.                                                     |
| Név(ek) másolása                                     | Másolás       |   ✓    |  ✓   | A vágólapra másolja a torrent nevét/neveit.                                                                               |
| Magnet link(ek) másolása                             | Másolás       |   ✓    |  ✓   | A vágólapra másolja a magnet linket/linkeket.                                                                             |
| Info hash(-ek) másolása                              | Másolás       |   ✓    |  ✓   | A vágólapra másolja az info hash-t/hash-eket.                                                                             |
| Mentési útvonal(ak) másolása                         | Másolás       |   ✓    |  ✓   | A vágólapra másolja a mentési útvonal(ak)at.                                                                              |
| Másolás JSON-ként                                    | Másolás       |   ✓    |  ✓   | A vágólapra másolja a kijelölt torrente(ke)t nyers JSON-ként.                                                             |
| Rögzítés felülre                                     | Sor rögzítése |   ✓    |  ✓   | A táblázat tetejére rögzíti a sort, figyelmen kívül hagyva a rendezést és a szűrőket.                                     |
| Rögzítés alulra                                      | Sor rögzítése |   ✓    |  ✓   | A táblázat aljára rögzíti a sort, figyelmen kívül hagyva a rendezést és a szűrőket.                                       |
| Rögzítés feloldása                                   | Sor rögzítése |   ✓    |  ✓   | Feloldja a sor rögzítését.                                                                                                |
| Eltávolítás                                          | -             |   ✓    |  ✓   | Törli a kijelölt torrente(ke)t. Tartsd lenyomva a `Shift`-et, hogy a "fájlok törlése is" opció alapból be legyen jelölve. |

## Oldalsáv szűrők

Az oldalsáv öt szűrőcsoportra bontja a torrentlistát, mindegyik bejegyzés mellett egy számlálóval:

- **Állapot** - Összes, Letöltés alatt, Befejezett, Aktív, Inaktív, Leállítva, Ellenőrzés alatt, Hibás. Ezek a qBittorrent alapul szolgáló torrentállapotainak levezetett csoportosításai, nem nyers állapotnevek.
- **Trackerek** - egy bejegyzés minden egyedi tracker-gépnévhez a torrentjeid között, plusz egy bejegyzés a tracker nélküli torrentekhez.
- **Kategóriák** - egy bejegyzés minden kategóriához, egy **Kezelés** gyorsgombbal egyenesen a [Kezelés > Kategóriák](./manage/categories) oldalra.
- **Címkék** - egy bejegyzés minden címkéhez, egy **Kezelés** gyorsgombbal egyenesen a [Kezelés > Címkék](./manage/tags) oldalra.
- **Mentési útvonalak** - egy bejegyzés minden használatban lévő, egyedi mentési útvonalhoz.

A Trackerek, Kategóriák, Címkék és Mentési útvonalak mindegyikéhez saját szűrőmező tartozik a hosszú listák kereséséhez. Minden csoport - az Állapotot is beleértve - ugyanígy működik: egy bejegyzés kiválasztása hozzáadja azt az adott csoport aktív szűréséhez, és egy csoporton belül több bejegyzés is kiválasztható - a táblázat bármelyikükre illeszkedő torrenteket megjeleníti. Egy már aktív bejegyzés kiválasztása eltávolítja azt. A különböző csoportokban tett kiválasztások együtt szűkítik a listát: egy torrentnek minden olyan csoportban illeszkednie kell legalább egy kiválasztott bejegyzésre, amelyben van aktív szűrés, hogy megjelenjen a táblázatban. Amint bármely szűrő aktívvá válik bárhol az oldalsávon, egy **Összes törlése** gomb jelenik meg a csoportok alatt, amely egyszerre visszaállítja az összes szűrőt.

### Az oldalsáv összecsukása

![Kibontott oldalsáv](/screenshots/torrent-list-view/sidebar-expanded.png)
![Összecsukott oldalsáv](/screenshots/torrent-list-view/sidebar-collapsed.png)

Kattints a BitButler logó melletti ikonra az oldalsáv egy szűk ikonsávvá csukásához; a logóra kattintva pedig újra kibontható. Az összecsukás csak azt változtatja meg, mi látszik, nem azt, mi van kiválasztva:

- A Trackerek, Kategóriák, Címkék és Mentési útvonalak - a szűrőmezőikkel és **Kezelés** gyorsgombjaikkal együtt - teljesen eltűnnek összecsukott állapotban.
- Az Állapot egy csak ikonokból álló oszlopra zsugorodik; húzd rá az egeret egy ikonra a nevéért. Egy **Összes törlése** ikon jelenik meg az oszlop alján, ha van aktív szűrő.
- A rejtett csoportokban már kiválasztott szűrők továbbra is érvényben maradnak a táblázatra - az összecsukás csak elrejti őket, nem törli.

A becsukott vagy kibontott állapotot a BitButler megjegyzi a következő megnyitásig.

## Állapotsáv

Az ablak alján futó sáv élő kapcsolati és átviteli információkat mutat: kapcsolat állapota, DHT csomópontok száma, megosztási arány, globális letöltött/feltöltött összesen (az összesített adatok opcionális widgetként is elérhetők), aktuális letöltési/feltöltési sebesség (az esetleges aktív sebességkorláttal alatta), szabad lemezterület, hány torrent van kijelölve a jelenleg láthatókból, valamint egy lekérdezés-jelző, amelyre kattintva szüneteltethető vagy folytatható a háttérbeli lekérdezés. Egy alternatívsebességkorlát-kapcsoló ezen widgetek bal oldalán található. Lásd [BitButler beállítások > Állapotsáv](./settings/bitbutler-settings#allapotsav) annak kiválasztásához, mely widgetek jelenjenek meg, és milyen sorrendben.
