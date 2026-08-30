<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Salva un fotogramma, una clip o il suo audio da Instagram e TikTok con un clic. Una piccola estensione per il browser con cui raccogliere riferimenti.**

[![Ultima versione](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Licenza](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Browser](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · **Italiano** · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Apri un post e nell’angolo compare un pulsante rotondo. Premendolo, ciò che è sullo schermo finisce nella cartella dei download. Lo strumento è tutto qui.

## Installazione

### Chrome

Chrome non consente di installare estensioni al di fuori del proprio store, e quello store non pubblica estensioni di questo tipo. L’installazione è quindi manuale:

1. Scarica `stash-chrome-x.y.z.zip` dall’[ultima release](https://github.com/antonyshakirov/stash/releases/latest) e decomprimilo.
2. Apri `chrome://extensions` e attiva la modalità sviluppatore.
3. Premi «Carica estensione non pacchettizzata» e scegli la cartella decompressa.

Anche l’aggiornamento è manuale. Le estensioni non pacchettizzate non si aggiornano mai da sole: Chrome non ha alcun meccanismo per farlo. Scarica la nuova versione e premi «Ricarica» sulla stessa pagina.

### Firefox

[Installa Stash](https://antonshakirov.com/stash/stash-latest.xpi) con un clic. Il pacchetto è firmato da Mozilla, quindi non servono né store né modalità sviluppatore, e si aggiorna da solo. Richiede Firefox 140 o successivo.

Ricarica le schede già aperte dopo l’installazione: l’estensione non le raggiunge.

## Come funziona

Apri il post o la clip per intero. Su Instagram è un indirizzo tipo `/p/…` o `/reel/…`, su TikTok `/@autore/video/…` o `/@autore/photo/…`. In basso a destra compare un pulsante rotondo e, accanto, uno con una nota musicale quando c’è audio da prendere.

I fotogrammi si salvano uno alla volta. In un carosello scorri fino alla slide che vuoi e premi: parte esattamente quella. Tre slide su sette vuol dire tre pressioni.

Nel feed e nella griglia del profilo il pulsante non c’è, ed è voluto. Lì sotto il cursore c’è una miniatura, e il file verrebbe peggiore dell’originale.

L’audio viene estratto dalla clip stessa e dura esattamente quanto lei. Dieci secondi di una canzone nella clip sono dieci secondi nel file.

Salvare due volte lo stesso fotogramma non crea un doppione: l’estensione ricorda ciò che ha già e lo dice. Se la copia la vuoi comunque, premi una seconda volta di seguito.

## Dove finiscono i file

| Cosa | Dove | Esempio di nome |
|---|---|---|
| Clip | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Immagini | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Audio | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Il numero finale è quello della slide nel carosello. Un post normale non ce l’ha.

I nomi delle cartelle si possono cambiare: clic destro sull’icona di Stash nella barra, poi «Opzioni». Un campo vuoto ripristina il nome predefinito. La barra indica annidamento: `Refs/Saved Reels` mette una cartella dentro un’altra.

## Cosa Stash non fa

Stash non invia di sua iniziativa nemmeno una richiesta a Instagram o TikTok. L’estensione legge i dati che la pagina ha già ricevuto per mostrarti il post e, quando non ci sono, lo dice invece di andarseli a prendere. Non viene inviato nulla da nessuna parte: il file va dal CDN della piattaforma al disco della stessa persona che sta guardando il post.

Non viene aggirata nessuna firma né protezione, nessun accesso viene automatizzato, nessun account altrui viene toccato e nessuna statistica viene raccolta.

Non c’è scaricamento in blocco di caroselli, profili o raccolte, non c’è coda di download né scelta manuale della qualità. L’audio viene copiato così com’è.

YouTube non è supportato.

## Diritti e responsabilità

Stash non è affiliato a Instagram, TikTok o Meta né approvato da loro. I loro nomi compaiono qui solo per dire dove funziona l’estensione.

I diritti su ciò che salvi appartengono a chi lo ha pubblicato. Questa estensione non concede alcun diritto sul materiale altrui. Salvare il lavoro di qualcun altro per guardarlo e raccogliere riferimenti è una cosa; ripubblicarlo o usarlo commercialmente è un’altra, e ne risponde chi lo ha salvato.

## Altro

Compilazione, architettura del codice e risoluzione dei problemi sono nel [README in inglese](../../README.md).

## Licenza

[MIT](../../LICENSE).
