---
title: Rendszertálca és értesítések
description: Tálcára kicsinyítés viselkedése, a tálca gyorsműveleti menüje és az asztali értesítések.
---

# Rendszertálca és értesítések

A BitButler minimalizált állapotban is fut a rendszertálcán, gyorsműveletekkel a főablak újranyitása nélkül is, és értesíthet, amikor egy torrent befejeződik.

## Kicsinyítés a tálcára

A főablak minimalizálása elrejti azt, ahelyett hogy a tálcán (taskbaron) mutatná; az alkalmazás tovább fut, és elérhető marad a tálcaikonon keresztül. Amikor ez egy munkamenetben először történik meg, a BitButler egy egyszeri értesítést mutat, amely tudatja, hogy továbbra is fut a háttérben. Lásd [BitButler beállítások > Indítás](./settings/bitbutler-settings#inditas) a **Kicsinyítve indítás** opcióért, amely egyenesen ebbe az állapotba indul.

Kattints a tálcaikonra a főablak be- és kikapcsolásához: ha rejtett vagy minimalizált, visszaáll és maximalizálódik; ha már látható, a kattintás újra elrejti.

## Tálcamenü

Kattints jobb gombbal (egyes platformokon bal gombbal) a tálcaikonra egy gyorsműveleti menühöz, amely a főablak rejtett állapotában is működik:

- **Megjelenítés** / **Elrejtés** - a főablak be- és kikapcsolása.
- **Összes torrent indítása** / **Összes torrent leállítása** - folytatja vagy szünetelteti az aktuálisan aktív szerver minden torrentjét.
- **Globális feltöltési korlát eltávolítása** / **Globális letöltési korlát eltávolítása** - törli a szerver globális átviteli korlátait.
- **Alternatív sebesség váltása** - átváltja a szervert a normál és az alternatív globális sebességkorlátok között.
- **Kilépés** - teljesen bezárja a BitButlert, a tálcaikonnal együtt.

A torrentvezérlő és átvitelikorlát-elemek le vannak tiltva, amikor nincs aktív, csatlakoztatott szerver, amelyre hatnának.

## Értesítések

Amikor egy torrent befejezi a letöltést, a BitButler kétféleképpen tud erről tudatni, attól függően, hogy a főablak éppen minimalizálva van-e:

- **Minimalizálva** - egy natív asztali értesítés jelenik meg, "Letöltés befejezve" címmel, a torrent nevével a törzsében.
- **Látható** - egy sikerüzenet jelenik meg helyette az alkalmazáson belül, abban a sarokban, amelyet az "Alkalmazáson belüli értesítés pozíciója" beállítás határoz meg a [BitButler beállítások > Megjelenés](./settings/bitbutler-settings#megjelenes) alatt.

Ehhez nincs külön be-/kikapcsoló - attól függ, hogy az ablak épp minimalizálva van-e abban a pillanatban, amikor a torrent befejeződik.
