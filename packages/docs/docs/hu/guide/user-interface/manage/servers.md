---
title: Szerverek
description: A BitButler által elérni kívánt qBittorrent-nox szerverek hozzáadása, közötti váltás és kezelése.
---

# Szerverek

A BitButler egy vagy több távoli qBittorrent-nox példányhoz csatlakozik a webes API-jukon keresztül. Minden kapcsolat helyben kerül tárolásra (a jelszavak nyugalmi állapotban titkosítva vannak), és a **Szerverek kezelése** párbeszédablakból kezelhető.

## Szerver hozzáadása

Nyisd meg a **Szerverek kezelése** párbeszédablakot akár a bejelentkezési képernyőről, akár a főablak eszköztárából: **Kezelés > Szerverek**. Kattints a **Szerver hozzáadása** gombra a kapcsolatszerkesztő megnyitásához.

![Add server dialog placeholder](https://placehold.co/600x400/EEE/31343C?text=Add+Server)

### Kapcsolati mezők

| Mező                                     | Leírás                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kapcsolat neve                           | Egy címke ehhez a szerverhez, amely végig megjelenik a felületen.                                                                                                                                                                                                                                                 |
| Protokoll                                | `http` vagy `https`.                                                                                                                                                                                                                                                                                              |
| Gép (Host)                               | A szerver gépneve vagy IP-címe.                                                                                                                                                                                                                                                                                   |
| Port                                     | A qBittorrent webes felület portja, 1 és 65535 között.                                                                                                                                                                                                                                                            |
| Felhasználónév (opcionális)              | Hagyd üresen, ha a webes felület nem igényel hitelesítést.                                                                                                                                                                                                                                                        |
| Jelszó (opcionális)                      | Hagyd üresen, ha a webes felület nem igényel hitelesítést. Egy mentett jelszóval rendelkező szerver szerkesztésekor ez a mező jelzi, hogy már van mentett jelszó - üresen hagyása **eltávolítja** a mentett jelszót, ezért add meg újra (vagy egy újat), ha meg szeretnéd tartani a kapcsolat hitelesítő adatait. |
| Kapcsolat beállítása alapértelmezettként | Lásd [Alapértelmezett szerver beállítása](#alapertelmezett-szerver-beallitasa) lentebb.                                                                                                                                                                                                                           |

Kattints a **Mentés** gombra a kapcsolat hozzáadásához a szerverlistádhoz.

## Szerverek közötti váltás

A Szerverek kezelése lista minden beállított kapcsolatot megmutat, a protokolljukkal/gépnevükkel/portjukkal, valamint egy dugóikonnal az éppen aktív mellett. Kattints a **Csatlakozás** gombra bármely másik szerveren az arra való váltáshoz. Használd a lista tetején lévő szűrőmezőt a névre vagy gépnévre való kereséshez.

## Alapértelmezett szerver beállítása

Egy kapcsolat alapértelmezettként való megjelölése (a jelölőnégyzet ikon minden szerver mellett a listában, vagy a "Kapcsolat beállítása alapértelmezettként" opció a szerkesztőben) arra utasítja a BitButlert, hogy induláskor automatikusan válassza ki és csatlakozzon ahhoz a szerverhez, ahelyett hogy a bejelentkezési képernyőt mutatná. Egyszerre csak egy szerver lehet alapértelmezett - egy új megjelölése törli az előzőt.

## Szerver szerkesztése és törlése

A Szerverek kezelése listából használd a ceruzaikont egy kapcsolat szerkesztőben való újranyitásához, vagy a kukaikont a törléséhez. A törlés előbb megerősítést kér, mivel a művelet nem vonható vissza - az adott kapcsolathoz beállított [útvonal-hozzárendelések](../settings/bitbutler-settings#utvonal-hozzarendelesek) vagy lekérdezési beállítások a törlés után már nem érvényesek.
