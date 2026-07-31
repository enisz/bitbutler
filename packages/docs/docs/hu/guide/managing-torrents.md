---
title: Torrentek kezelése
description: Torrentek hozzáadása, szüneteltetése, folytatása és rendszerezése a főablakból.
---

# Torrentek kezelése

Miután csatlakoztál egy szerverhez, a [Torrentlista nézet](./user-interface/torrent-list-view) az a hely, ahol új torrenteket adhatsz hozzá, és irányíthatod a már meglévőket.

## Torrentek hozzáadása

Kattints az eszköztár **Hozzáadás** gombjára a [Torrent hozzáadása ablak](./user-interface/add-torrent-window) megnyitásához. Ez a párbeszédablak átfogó felületet biztosít új torrentek hozzáadásához, számos beállítási lehetőséggel.

### Fájlból

Kattints a **Tallózás** gombra egy `.torrent` fájl kiválasztásához (vagy húzz egyet közvetlenül a mezőre). Kiválasztás után a BitButler megmutatja a torrent teljes méretét a célhelyen elérhető szabad hely mellett. Opcionálisan nevezd át, majd állíts be mentési útvonalat, kategóriát és címkéket a **Hozzáadás** gombra kattintás előtt.

### Mappából

Torrenteket közvetlenül egy mappából is hozzáadhatsz a bemeneti mód "Mappa" opciójának kiválasztásával. Ez átvizsgálja a kiválasztott könyvtárat `.torrent` fájlok után; kapcsold be a **Rekurzív** opciót (alapból kikapcsolva), hogy az alkönyvtárakat is átvizsgálja. A szerveren már létező fájlok megjelölésre kerülnek, és ki vannak zárva a kiválasztásból - részletekért lásd a [Torrent hozzáadása ablak](./user-interface/add-torrent-window#hozzaadas-mappabol) oldalt.

### Mágneslinkből

Váltsd a bemeneti módot **Link**-re, és illessz be egy vagy több mágneslinket a szövegmezőbe, soronként egyet. Fájlhoz hasonlóan itt is beállíthatsz mentési útvonalat, kategóriát és címkéket a hozzáadás előtt - a Fájlok fül mágneslinkek esetén nem elérhető, mivel egy mágneslinknek nincs fájllistája, amíg a metaadatait a hozzáadás után le nem kérdezi.

## Szüneteltetés és folytatás

Jelölj ki egy vagy több torrentet, és használd az eszköztár **Indítás** és **Leállítás** gombjait a folytatásukhoz vagy szüneteltetésükhöz, vagy az **Összes indítása** / **Összes leállítása** gombokat, hogy minden torrentre hasson, a kijelöléstől függetlenül. Lásd [Torrentlista nézet > Eszköztár](./user-interface/torrent-list-view#eszkoztar) az eszköztár többi műveletéért.

## Duplikált torrentek

Ha egy már a szerveren lévő torrentet próbálsz hozzáadni, a BitButler a [Torrent már létezik ablakot](./user-interface/torrent-exists-window) mutatja helyette: a meglévő torrent állapotát, méretét, arányát, seedjeit/peerjeit, hozzáadás dátumát, mentési útvonalát és kategóriáját/címkéit (ha van). Innen egyenesen a torrenthez ugorhatsz a **Részletek megnyitása** gombbal, vagy bezárhatod a párbeszédablakot. Ha "A torrent fájlok törlése, ha a torrent már szerepel a listában" opció be van kapcsolva (lásd [BitButler beállítások > Viselkedés](./user-interface/settings/bitbutler-settings#viselkedes)), és a forrás `.torrent` fájl ismert, a BitButler automatikusan törli lemezről az immár felesleges fájlt, amint a párbeszédablak megnyílik. Ez fájlból és mágneslinkből történő hozzáadásra vonatkozik; mappa módban a duplikátumok közvetlenül a mappa táblázatában jelennek meg megjelölve, nem ez a párbeszédablak nyílik meg.

## Torrent átnevezése

Kattints jobb gombbal egyetlen torrentre, és válaszd a **Kezelés > Torrent átnevezése** lehetőséget (több kijelölés esetén ez nem érhető el). A párbeszédablak egy szerkeszthető mezőben mutatja az aktuális nevet; a **Mentés** letiltva marad, amíg ténylegesen meg nem változtatod. Az átnevezés frissíti a torrent megjelenített nevét, és - ahol lehetséges - a lemezen lévő fájlt vagy gyökérmappát is ennek megfelelően: egy egyfájlos torrentnél a fájl kerül átnevezésre, egy többfájlos torrentnél a gyökérmappa.

## Kategória és címkék beállítása kijelölésre

Kattints jobb gombbal egy vagy több torrentre, és válaszd a **Kezelés > Kategória beállítása** vagy **Kezelés > Címkék beállítása** lehetőséget, hogy egyszerre rendeld hozzá azokat minden aktuálisan kijelölt torrenthez - a párbeszédablak fejléce vagy az egyetlen torrent nevét, vagy egy "N torrent kijelölve" számlálót mutat. Mindkét párbeszédablak lehetővé teszi, hogy egy még nem létező kategória- vagy címkenevet gépelj be, és azt helyben, a párbeszédablak elhagyása nélkül létrehozd. Ez egy kijelölésenkénti gyorsmegoldás, amely különbözik az adminisztrációra fókuszáló [Kezelés > Kategóriák](./user-interface/manage/categories) és [Kezelés > Címkék](./user-interface/manage/tags) párbeszédablakoktól, amelyek a teljes listát kezelik, nem egyetlen kijelölés hozzárendelését.

## Torrent törlése

Kattints a **Törlés** gombra az eszköztáron (vagy használd a táblázat saját törlés műveletét) egy megerősítő párbeszédablak megnyitásához, amely felsorolja, hány torrent eltávolítására készülsz. Egy jelölőnégyzet - alapból kikapcsolva, vagy előre bejelölve, ha a törlés kezdeményezésekor lenyomva tartottad a **Shift**-et - szabályozza, hogy az alapul szolgáló fájlok is törlődjenek-e lemezről; bejelölése pontosan megmutatja, mennyi lemezterület szabadul fel. A megerősítés eltávolítja a torrente(ke)t a qBittorrentből (és a fájljaikat, ha az a jelölőnégyzet be volt jelölve); a Mégse mindent érintetlenül hagy.

## Kategóriák és címkék

A torrentek kategória vagy címke szerinti rendszerezéséhez lásd [Kategóriák kezelése](./user-interface/manage/categories) és [Címkék kezelése](./user-interface/manage/tags).
