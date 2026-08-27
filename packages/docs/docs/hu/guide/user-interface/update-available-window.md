---
title: Frissítés elérhető ablak
description: A Frissítés elérhető ablak bemutatása, a kiadási megjegyzések accordionja, a letöltések és az alkalmazáson belüli néma frissítési folyamat.
---

# Frissítés elérhető ablak

![Frissítés elérhető ablak, amely két újabb kiadást és Linux letöltéseket listáz](/screenshots/update-available/update-available.png)

Amint egy frissítés-ellenőrzés újabb BitButler kiadást talál a jelenleg futónál, ez az ablak jelenik meg a főablak felett. Ez automatikusan megtörténik induláskor, ha az "Automatikus frissítések" be van kapcsolva a [BitButler beállítások > Indítás](./settings/bitbutler-settings#inditas) alatt, vagy bármikor manuálisan is kiválthatod a **Súgó > Frissítések keresése** menüponttal az [alkalmazásmenüben](./application-menu#sugo). Ha nincs újabb kiadás, nem jelenik meg ablak - helyette egy felugró értesítés jelzi, hogy már a legújabb verziót használod.

Az alcím összefoglalja, mennyire vagy lemaradva: pl. "Jelenleg a v2.0.1 verziót használod, 2 verzióval vagy lemaradva a legújabbtól (v2.0.3)".

## Kiadási megjegyzések

A jelenlegi verziód és a legújabb kiadás közötti összes verzió listázva van egy accordionban, a legújabbal kezdve, mindegyiknél feltüntetve a verziószámot, a kiadás dátumát és a relatív időt. Egyszerre csak egy elem van kinyitva - egy másik kinyitása becsukja az előzőt. Minden elem törzse az adott kiadás Markdown formátumú változásnaplóját jeleníti meg.

## Letöltések

A **Letöltés `<operációs rendszer>` rendszerre** szakasz az adott kiadás fájljait listázza, a platformodhoz szűrve (telepítő és zip Windows alatt, AppImage/deb/rpm/snap/tar.gz Linux alatt) - ha egyik sem illeszkedik, az összes fájl megjelenik. Egy fájlra kattintva a letöltési URL megnyílik az alapértelmezett böngésződben; ebből a listából semmi sem töltődik le magán az alkalmazáson belül. A lista alatt egy figyelmeztetés utal a kódaláírásra, a platformodnak megfelelő szöveggel - lásd [Kódaláírási figyelmeztetések](#kodalairasi-figyelmeztetesek).

## Kódaláírási figyelmeztetések

A BitButlernek nincs kódaláíró tanúsítványa, ezért egyik buildje sincs kódaláírással ellátva. Hogy ez mit jelent, az a platformodtól függ:

- **Windows** - a Windows SmartScreen nem ismeri el a BitButlert megbízható kiadóként, és jelezheti ezt. Manuális letöltésnél a böngésződ vagy a Windows egy "A Windows megvédte a számítógépet" figyelmeztetést mutathat, mielőtt a telepítő elindulna - válaszd a **További információ > Futtatás mindenképp** lehetőséget a folytatáshoz. A **Frissítés most** gombbal indított frissítés telepítővarázsló nélkül indítja el a letöltött telepítőt, így nincs párbeszédablak, amin keresztülkattinthatnál, ha a SmartScreen közbelép; emiatt az automatikus telepítés elakadhat vagy sikertelen lehet, ami az aláíratlan futtatás ismert korlátja, nem hiba.
- **Linux** - a letöltött csomag telepítése jelszót kérhet, vagy a disztribúciód beállításaitól függően sikertelen lehet, mivel a csomag nincs aláírva.

Ha az automatikus telepítés elakad vagy sikertelen, töltsd le és futtasd manuálisan a [Letöltések](#letoltesek) listából az egyik fájlt.

## Lábléc

![Frissítés elérhető ablak letöltés közben, bájtszámlálóval és folyamatjelzővel](/screenshots/update-available/download-in-progress.png)

A lábléc tartalma a frissítés állapotától függ:

- **Alaphelyzet** - **Frissítés most**, **Ezen verziók kihagyása**, **Kiadások megtekintése** és **Bezárás**.
- **Ellenőrzés / Letöltés** - a fenti gombok helyett egy folyamatjelző sor jelenik meg, valamint egy **Mégse** gomb.
- **Letöltve** - csak egy "Újraindítás a telepítéshez..." felirat, amíg az alkalmazás újraindul a telepítőbe.

Az ablak nem zárható be (sem a Bezárás gombbal, sem az Esc billentyűvel, sem a háttérre kattintva), amíg ellenőrzés, letöltés zajlik, vagy az újraindítás van folyamatban.

### Frissítés most

Csak akkor jelenik meg, ha a BitButler képes önmagát a helyén frissíteni - jelenleg ez a Windowsra NSIS telepítővel telepített verziót, vagy a Linux AppImage-et jelenti. Más buildeknél (hordozható/zip Windows alatt, deb/rpm/snap/tar.gz Linux alatt, macOS) ez a gomb nem jelenik meg; ilyenkor a letöltési linkeket használd.

Kattintásra elindul az alkalmazáson belüli folyamat: a lábléc egy folyamatjelző sorra vált, amely a fájl nevét, a letöltött és teljes bájtszámot, valamint egy százalékos sávot mutat, amíg a legújabb kiadás letöltődik. A **Mégse** megszakítja a letöltést, és visszatér az alaphelyzeti láblécre. A letöltés befejeztével az alkalmazás bezárja magát, néma módban (telepítővarázsló nélkül) újratelepíti magát, majd automatikusan újraindul - további teendőd nincs, hacsak a telepítés meg nem szakad; lásd [Kódaláírási figyelmeztetések](#kodalairasi-figyelmeztetesek).

### Ezen verziók kihagyása

Elmenti a listázott legújabb verziót, így a jövőbeli **automatikus** ellenőrzések (induláskor) nem nyitják meg újra ezt az ablakot, amíg egy ennél is újabb verzió meg nem jelenik. Az alkalmazásmenüből indított manuális ellenőrzésekre nincs hatással - azok mindig megmutatják az elérhető frissítést.

### Kiadások megtekintése

Megnyitja a projekt GitHub kiadások oldalát az alapértelmezett böngésződben.
