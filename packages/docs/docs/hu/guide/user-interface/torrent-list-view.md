---
title: Torrentlista nézet
description: A főablak bemutatása - eszköztár, oldalsáv szűrők, keresés, torrenttáblázat és állapotsáv.
---

# Torrentlista nézet

A főablak az, ahol a legtöbb időt töltöd a BitButlerben. Egy eszköztár fut végig a tetején, egy szűrő oldalsáv a bal oldalon helyezkedik el, a torrenttáblázat kitölti a középső részt, egy állapotsáv pedig végigfut az alján.

![Torrentlista nézet eszköztárral, oldalsáv szűrőkkel, torrenttáblázattal és állapotsávval](/screenshots/torrent-list-view/overview.png)

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

Egy torrentsorra jobb gombbal kattintva megnyílik egy helyi menü, amely ugyanazokat az Indítás, Leállítás és Kényszerített folytatás műveleteket tartalmazza, mint az eszköztár - mindegyik a [billentyűparancsát](../keyboard-shortcuts#vezerles) is jelzi -, plusz a [Torrent részletei](./torrent-details-view) elemet, valamint almenüket a Fájlok, Kezelés, Sor, Átvitel, Karbantartás, Másolás és Sor rögzítése funkciókhoz. Az alján egy Eltávolítás elem törli a kijelölt torrente(ke)t, szintén jelezve a `Shift` módosítót a "fájlok törlése is" opcióhoz.

![Torrenttáblázat jobb kattintásos helyi menüje](/screenshots/torrent-list-view/context-menu.png)

## Oldalsáv szűrők

Az oldalsáv öt szűrőcsoportra bontja a torrentlistát, mindegyik bejegyzés mellett egy számlálóval:

- **Állapot** - Összes, Letöltés alatt, Befejezett, Aktív, Inaktív, Leállítva, Ellenőrzés alatt, Hibás. Ezek a qBittorrent alapul szolgáló torrentállapotainak levezetett csoportosításai, nem nyers állapotnevek.
- **Trackerek** - egy bejegyzés minden egyedi tracker-gépnévhez a torrentjeid között, plusz egy bejegyzés a tracker nélküli torrentekhez.
- **Kategóriák** - egy bejegyzés minden kategóriához, egy **Kezelés** gyorsgombbal egyenesen a [Kezelés > Kategóriák](./manage/categories) oldalra.
- **Címkék** - egy bejegyzés minden címkéhez, egy **Kezelés** gyorsgombbal egyenesen a [Kezelés > Címkék](./manage/tags) oldalra.
- **Mentési útvonalak** - egy bejegyzés minden használatban lévő, egyedi mentési útvonalhoz.

A Trackerek, Kategóriák, Címkék és Mentési útvonalak mindegyikéhez saját szűrőmező tartozik a hosszú listák kereséséhez. Egy bejegyzés kiválasztása az adott értékre szűri a táblázatot; csoportonként egyszerre csak egy kiválasztás aktív. Amint bármely szűrő aktívvá válik bárhol az oldalsávon, egy **Összes törlése** gomb jelenik meg a csoportok alatt, amely egyszerre visszaállítja az összes szűrőt.

## Állapotsáv

Az ablak alján futó sáv élő kapcsolati és átviteli információkat mutat: kapcsolat állapota, DHT csomópontok száma, megosztási arány, globális letöltött/feltöltött összesen, aktuális letöltési/feltöltési sebesség (az esetleges aktív sebességkorláttal alatta), szabad lemezterület, hány torrent van kijelölve a jelenleg láthatókból, valamint egy lekérdezés-jelző, amelyre kattintva szüneteltethető vagy folytatható a háttérbeli lekérdezés. Egy alternatívsebességkorlát-kapcsoló ezen widgetek bal oldalán található. Lásd [BitButler beállítások > Állapotsáv](./settings/bitbutler-settings#allapotsav) annak kiválasztásához, mely widgetek jelenjenek meg, és milyen sorrendben.
