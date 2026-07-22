---
title: GYIK
description: Gyakori kérdések a licencelésről, a platformtámogatásról és arról, hogyan viszonyul a BitButler a qBittorrent-noxhoz.
---

# GYIK

## Ingyenes a BitButler használata?

Igen. A BitButler nyílt forráskódú, és MIT licenc alatt kerül kiadásra.

## Mely platformokat támogatja?

Windows és Linux. Windowson telepítőként, hordozható buildként vagy sima `.zip`-ként érhető el; Linuxon AppImage-ként, `.deb`, `.rpm`, `.snap` vagy `.tar.gz` formátumban. Lásd [Kezdő lépések > Telepítés](./getting-started#telepites) a részletekért. macOS build jelenleg nincs.

## A BitButler helyben futtatja a torrenteket?

Nem. A BitButler egy távoli kliens - egy külön futtatott qBittorrent-nox példányhoz csatlakozik (például egy otthoni szerveren, NAS-on vagy VPS-en), és a qBittorrent webes API-ján keresztül vezérli azt. A tényleges letöltés és seedelés azon a szerveren történik, nem a BitButlert futtató gépen.

Vedd figyelembe azt is, hogy a BitButler jelenleg a qBittorrent v4.1.0 - v4.6.x verzióit célozza; az újabb v5.x webes API-val való használat működhet, de hivatalosan még nem támogatott.

## Hol jelenthetek hibát?

Nyiss egy issue-t a [BitButler GitHub repóján](https://github.com/enisz/bitbutler). Issue sablonok állnak rendelkezésre hibabejelentésekhez, fejlesztési javaslatokhoz, funkciókérésekhez és karbantartási feladatokhoz - válaszd ki a megfelelőt, vagy használd az általános "other" sablont, ha egyik sem illik.
