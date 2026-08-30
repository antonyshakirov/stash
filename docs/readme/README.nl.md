<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Bewaart een beeld, een clip of het geluid ervan uit Instagram en TikTok met één klik. Een kleine browserextensie om referenties te verzamelen.**

[![Nieuwste versie](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Licentie](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Browsers](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · **Nederlands** · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Open een bericht en er verschijnt een ronde knop in de hoek. Eén druk erop zet wat er op het scherm staat in je downloadmap. Meer doet het gereedschap niet.

## Installatie

### Chrome

Chrome staat niet toe extensies buiten zijn eigen store te installeren, en die store publiceert dit soort extensies niet. De installatie gaat dus met de hand:

1. Download `stash-chrome-x.y.z.zip` uit de [nieuwste release](https://github.com/antonyshakirov/stash/releases/latest) en pak het uit.
2. Open `chrome://extensions` en zet de ontwikkelaarsmodus aan.
3. Klik op «Uitgepakte extensie laden» en kies de uitgepakte map.

Bijwerken gaat ook met de hand. Uitgepakte extensies werken zichzelf nooit bij — Chrome heeft daar geen mechanisme voor. Download de nieuwe versie en klik op dezelfde pagina op «Opnieuw laden».

### Firefox

[Stash installeren](https://antonshakirov.com/stash/stash-latest.xpi) met één klik. Het pakket is ondertekend door Mozilla, dus geen store en geen ontwikkelaarsmodus, en het werkt zichzelf bij. Vereist Firefox 140 of nieuwer.

Herlaad tabbladen die al open stonden: daar komt de extensie niet in.

## Hoe het werkt

Open het bericht of de clip helemaal. Bij Instagram is dat een adres als `/p/…` of `/reel/…`, bij TikTok `/@auteur/video/…` of `/@auteur/photo/…`. Rechtsonder verschijnt een ronde knop, en ernaast een knop met een noot zodra er geluid te halen valt.

Beelden worden één voor één bewaard. In een carrousel blader je naar de dia die je wilt en drukt: precies die vertrekt. Drie dia's van zeven betekent drie keer drukken.

In de tijdlijn en in het profielraster staat bewust geen knop. Wat daar onder de cursor ligt is een miniatuur, en het bestand zou slechter uitvallen dan het origineel.

Het geluid wordt uit de clip zelf gehaald en duurt precies zo lang als de clip. Tien seconden van een lied in de clip zijn tien seconden in het bestand.

Hetzelfde beeld twee keer bewaren levert geen dubbele op: de extensie onthoudt wat ze al heeft en zegt het. Wil je de kopie toch, druk dan een tweede keer achter elkaar.

## Waar de bestanden terechtkomen

| Wat | Waar | Voorbeeldnaam |
|---|---|---|
| Clips | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Beelden | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Geluid | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Het getal aan het eind is het nummer van de dia in de carrousel. Een gewoon bericht heeft dat niet.

De mapnamen kun je wijzigen: rechtsklik op het Stash-pictogram in de balk en kies «Opties». Een leeg veld herstelt de standaardnaam. Een schuine streep betekent nesteling: `Refs/Saved Reels` zet een map in een map.

## Wat Stash niet doet

Stash stuurt uit zichzelf geen enkel verzoek naar Instagram of TikTok. De extensie leest de gegevens die de pagina toch al ontving om je het bericht te tonen, en ontbreken die, dan zegt ze dat in plaats van ze op te halen. Er wordt niets ergens naartoe gestuurd: het bestand gaat van het CDN van het platform naar de schijf van dezelfde persoon die het bericht bekijkt.

Er worden geen handtekeningen of beveiligingen omzeild, geen aanmelding geautomatiseerd, geen accounts van anderen aangeraakt en geen statistieken verzameld.

Er is geen bulkdownload van carrousels, profielen of collecties, geen downloadwachtrij en geen handmatige kwaliteitskeuze. Het geluid wordt gekopieerd zoals het is.

YouTube wordt niet ondersteund.

## Rechten en verantwoordelijkheid

Stash is niet verbonden aan Instagram, TikTok of Meta en wordt door hen niet goedgekeurd. Hun namen staan hier alleen om te zeggen waar de extensie werkt.

De rechten op wat je bewaart liggen bij wie het plaatste. Deze extensie verleent geen enkel recht op het werk van anderen. Het werk van iemand anders bewaren om het te bekijken en referenties te verzamelen is één ding; het opnieuw publiceren of commercieel gebruiken is iets anders, en daarvoor is degene die het bewaarde verantwoordelijk.

## Meer

Bouwen, opbouw van de code en probleemoplossing staan in de [Engelse README](../../README.md).

## Licentie

[MIT](../../LICENSE).
