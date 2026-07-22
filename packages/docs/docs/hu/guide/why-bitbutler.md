---
title: Miért a BitButler
description: Mire való a BitButler, és miért létezik a qBittorrent saját webes felülete mellett.
---

# Miért a BitButler

A qBittorrent-nox már önmagában is rendelkezik webes felülettel - a BitButler azért létezik, mert egy böngészőfül nem mindig a legjobb hely a torrentek kezelésére. Egy dedikált asztali kliens: nincs elveszejthető fül, nincs oldalújratöltés, csak egy alkalmazás, amely mindig egy Alt+Tab távolságra van.

## Távoli kezelés

A BitButler maga nem futtat torrenteket - a hálózaton keresztül beszél a qBittorrent-nox webes API-jával, ugyanúgy, ahogyan egy böngésző tenné, csak egy natív ablakból egy oldal helyett. A qBittorrent-nox példányod bárhol lehet, ami hálózaton keresztül elérhető: otthoni szerveren, NAS-on vagy VPS-en.

## Több szerver támogatása

Állíts be annyi qBittorrent-nox kapcsolatot, amennyire szükséged van, és válts közöttük a bejelentkezési képernyőről vagy az eszköztár **Kezelés > Szerverek** párbeszédablakából. Minden kapcsolat megőrzi a saját lekérdezési intervallumát és útvonal-hozzárendeléseit, helyben tárolva, nyugalmi állapotban titkosított jelszavakkal - így a szerverváltás nem jelenti a hitelesítő adatok újbóli megadását, és semmi nem kerül elküldésre máshová, csak közvetlenül a saját szerveredre.

## Platformfüggetlenség

A BitButler natív buildként érhető el Windowsra és Linuxra egyaránt, ugyanarra az Electron és Angular alapra épülve, így az alkalmazás ugyanúgy néz ki és viselkedik, függetlenül attól, melyiken futtatod. Lásd [Kezdő lépések > Telepítés](./getting-started#telepites) a platformonként elérhető pontos csomagokért.
