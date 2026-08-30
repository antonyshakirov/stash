<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Speichert ein Bild, einen Clip oder dessen Ton aus Instagram und TikTok mit einem Klick. Eine kleine Browser-Erweiterung zum Sammeln von Referenzen.**

[![Aktuelle Version](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Lizenz](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Browser](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · **Deutsch** · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)


</div>

Öffne einen Beitrag, und in der Ecke erscheint ein runder Knopf. Ein Druck darauf legt das, was gerade auf dem Bildschirm ist, in deinen Download-Ordner. Mehr macht das Werkzeug nicht.

## Installation

### Chrome

Chrome erlaubt keine Installation von Erweiterungen außerhalb des eigenen Stores, und dieser Store veröffentlicht Erweiterungen dieser Art nicht. Die Installation läuft deshalb von Hand:

1. Lade `stash-chrome-x.y.z.zip` aus dem [neuesten Release](https://github.com/antonyshakirov/stash/releases/latest) herunter und entpacke es.
2. Öffne `chrome://extensions` und schalte den Entwicklermodus ein.
3. Klicke auf „Entpackte Erweiterung laden“ und wähle den entpackten Ordner.

Auch das Aktualisieren läuft von Hand. Entpackte Erweiterungen aktualisieren sich nie selbst — Chrome hat dafür keinen Mechanismus. Lade also die neue Version herunter und drücke auf derselben Seite auf „Neu laden“.

### Firefox

[Stash installieren](https://antonshakirov.com/stash/stash-latest.xpi) mit einem Klick. Das Paket ist von Mozilla signiert, es braucht also weder Store noch Entwicklermodus, und es aktualisiert sich von selbst. Erforderlich ist Firefox 140 oder neuer.

Lade nach der Installation offene Tabs neu: In bereits geöffnete Tabs gelangt die Erweiterung nicht.

## So funktioniert es

Öffne einen Beitrag oder Clip vollständig. Bei Instagram ist das eine Adresse wie `/p/…` oder `/reel/…`, bei TikTok `/@autor/video/…` oder `/@autor/photo/…`. Unten rechts erscheint ein runder Knopf, und daneben ein Knopf mit einer Note, wenn es Ton zu holen gibt.

Bilder werden einzeln gespeichert. Bei einem Karussell blätterst du zur gewünschten Folie und drückst: genau diese wird gespeichert. Drei von sieben Folien heißt dreimal drücken.

Im Feed und im Profilraster gibt es den Knopf bewusst nicht. Dort liegt unter dem Zeiger nur eine Miniatur, und die Datei würde schlechter ausfallen als das Original.

Der Ton wird aus dem Clip selbst herausgelöst und ist genauso lang wie der Clip. Zehn Sekunden eines Lieds im Clip heißen zehn Sekunden in der Datei.

Dasselbe Bild zweimal zu speichern erzeugt kein Duplikat: Die Erweiterung merkt sich, was sie schon hat, und sagt es. Willst du die Kopie trotzdem, drücke ein zweites Mal hintereinander.

## Wohin die Dateien kommen

| Was | Wohin | Beispielname |
|---|---|---|
| Clips | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Bilder | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Ton | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Die Zahl am Ende ist die Nummer der Folie im Karussell. Ein gewöhnlicher Beitrag hat keine.

Die Ordnernamen kannst du ändern: Rechtsklick auf das Stash-Symbol in der Leiste, dann „Optionen“. Ein leeres Feld stellt den Standard wieder her. Ein Schrägstrich bedeutet Verschachtelung, `Refs/Saved Reels` legt einen Ordner in einen Ordner.

## Was Stash nicht tut

Stash stellt von sich aus keine einzige Anfrage an Instagram oder TikTok. Die Erweiterung liest die Daten, die die Seite ohnehin schon erhalten hat, um dir den Beitrag zu zeigen; fehlen sie, sagt sie das, statt sie zu holen. Es wird nichts irgendwohin geschickt: Die Datei geht vom CDN der Plattform direkt auf die Festplatte derselben Person, die den Beitrag ansieht.

Es werden keine Signaturen und kein Schutz umgangen, keine Anmeldung automatisiert, keine fremden Konten angefasst und keine Statistiken erhoben.

Es gibt kein Herunterladen ganzer Karussells, Profile oder Sammlungen, keine Warteschlange und keine Auswahl der Qualität von Hand. Der Ton wird unverändert kopiert.

YouTube wird nicht unterstützt.

## Rechte und Verantwortung

Stash steht in keiner Verbindung zu Instagram, TikTok oder Meta und ist von ihnen nicht genehmigt. Ihre Namen stehen hier nur, um zu sagen, wo die Erweiterung arbeitet.

Die Rechte an dem, was du speicherst, liegen bei denen, die es veröffentlicht haben. Diese Erweiterung verleiht keinerlei Rechte an fremdem Material. Fremde Arbeit zu speichern, um sie anzusehen und Referenzen zu sammeln, ist das eine; sie erneut zu veröffentlichen oder kommerziell zu nutzen, ist das andere, und dafür haftet, wer sie gespeichert hat.

## Mehr

Bauen, Aufbau des Codes und Fehlersuche stehen im [englischen README](../../README.md).

## Lizenz

[MIT](../../LICENSE).
