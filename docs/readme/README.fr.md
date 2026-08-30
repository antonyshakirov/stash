<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Enregistre une image, un clip ou sa bande-son depuis Instagram et TikTok en un clic. Une petite extension de navigateur pour collectionner des références.**

[![Dernière version](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Licence](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Navigateurs](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · **Français** · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Ouvrez une publication et un bouton rond apparaît dans le coin. Une pression dépose ce qui est à l’écran dans votre dossier de téléchargements. C’est tout l’outil.

## Installation

### Chrome

Chrome n’autorise pas l’installation d’extensions en dehors de sa boutique, et cette boutique ne publie pas les extensions de ce type. L’installation se fait donc à la main :

1. Téléchargez `stash-chrome-x.y.z.zip` depuis la [dernière version](https://github.com/antonyshakirov/stash/releases/latest) et décompressez-la.
2. Ouvrez `chrome://extensions` et activez le mode développeur.
3. Cliquez sur « Charger l’extension non empaquetée » et choisissez le dossier décompressé.

La mise à jour est manuelle elle aussi. Les extensions non empaquetées ne se mettent jamais à jour toutes seules — Chrome n’a aucun mécanisme pour cela. Téléchargez la nouvelle version et cliquez sur « Actualiser » sur la même page.

### Firefox

[Installer Stash](https://antonshakirov.com/stash/stash-latest.xpi) en un clic. Le paquet est signé par Mozilla : ni boutique ni mode développeur, et il se met à jour tout seul. Firefox 140 ou plus récent est nécessaire.

Rechargez les onglets déjà ouverts après l’installation : l’extension ne les atteint pas.

## Comment ça marche

Ouvrez une publication ou un clip en entier. Sur Instagram c’est une adresse du type `/p/…` ou `/reel/…`, sur TikTok `/@auteur/video/…` ou `/@auteur/photo/…`. Un bouton rond apparaît en bas à droite, et un second bouton avec une note dès qu’il y a du son à prendre.

Les images s’enregistrent une par une. Dans un carrousel, faites défiler jusqu’à la diapositive voulue et appuyez : c’est exactement celle-là qui part. Trois diapositives sur sept, trois pressions.

Il n’y a volontairement pas de bouton dans le fil ni dans la grille du profil. Ce qui se trouve sous le curseur y est une vignette, et le fichier serait moins bon que l’original.

Le son est extrait du clip lui-même et dure exactement autant que lui. Dix secondes d’une chanson dans le clip, dix secondes dans le fichier.

Enregistrer deux fois la même image ne crée pas de doublon : l’extension se souvient de ce qu’elle a déjà et le dit. Si vous voulez quand même la copie, appuyez une seconde fois de suite.

## Où vont les fichiers

| Quoi | Où | Exemple de nom |
|---|---|---|
| Clips | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Images | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Son | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Le nombre à la fin est le numéro de la diapositive dans le carrousel. Une publication ordinaire n’en a pas.

Les noms de dossiers se changent : clic droit sur l’icône Stash dans la barre, puis « Options ». Un champ vide rétablit le nom par défaut. Une barre oblique signifie une imbrication : `Refs/Saved Reels` place un dossier dans un dossier.

## Ce que Stash ne fait pas

Stash n’envoie de lui-même aucune requête à Instagram ni à TikTok. L’extension lit les données que la page a déjà reçues pour vous montrer la publication, et quand elles manquent, elle le dit au lieu d’aller les chercher. Rien n’est envoyé nulle part : le fichier va du CDN de la plateforme au disque de la personne qui regarde la publication.

Aucune signature ni protection n’est contournée, aucune connexion n’est automatisée, aucun compte tiers n’est touché et aucune statistique n’est collectée.

Il n’y a pas de téléchargement en masse de carrousels, de profils ou de collections, pas de file d’attente, pas de choix manuel de la qualité. Le son est copié tel quel.

YouTube n’est pas pris en charge.

## Droits et responsabilité

Stash n’est ni affilié à Instagram, TikTok ou Meta, ni approuvé par eux. Leurs noms ne figurent ici que pour dire où l’extension fonctionne.

Les droits sur ce que vous enregistrez appartiennent à ceux qui l’ont publié. Cette extension ne confère aucun droit sur le travail d’autrui. Enregistrer le travail de quelqu’un pour le regarder et constituer des références est une chose ; le republier ou l’exploiter commercialement en est une autre, et cela engage celui qui l’a enregistré.

## Pour aller plus loin

La compilation, l’architecture du code et le dépannage sont dans le [README en anglais](../../README.md).

## Licence

[MIT](../../LICENSE).
