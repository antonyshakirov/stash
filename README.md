<div align="center">

<img src="icons/icon128.png" width="88" alt="Stash icon">

# Stash

**Save a frame, a clip or its soundtrack from Instagram and TikTok with a
single click. A small browser extension for collecting references.**

[![Latest release](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Browsers](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)
[![Stars](https://img.shields.io/github/stars/antonyshakirov/stash?style=social)](https://github.com/antonyshakirov/stash/stargazers)

[Bahasa Indonesia](docs/readme/README.id.md) · [Deutsch](docs/readme/README.de.md) · **English** · [Español](docs/readme/README.es.md) · [Français](docs/readme/README.fr.md) · [Italiano](docs/readme/README.it.md) · [Nederlands](docs/readme/README.nl.md) · [Polski](docs/readme/README.pl.md) · [Português](docs/readme/README.pt.md) · [Tiếng Việt](docs/readme/README.vi.md) · [Türkçe](docs/readme/README.tr.md) · [Русский](docs/readme/README.ru.md) · [Українська](docs/readme/README.uk.md) · [עברית](docs/readme/README.he.md) · [اردو](docs/readme/README.ur.md) · [العربية](docs/readme/README.ar.md) · [فارسی](docs/readme/README.fa.md) · [हिन्दी](docs/readme/README.hi.md) · [ไทย](docs/readme/README.th.md) · [中文](docs/readme/README.zh.md) · [日本語](docs/readme/README.ja.md) · [한국어](docs/readme/README.ko.md)

</div>

Open a post and a round button appears in the corner. Press it, and whatever
is on screen lands in your Downloads folder under a readable name. That is the
whole tool.

## Install

### Chrome

Chrome does not allow installing extensions from outside its own store, and
that store does not publish extensions of this kind, so the install is manual:

1. Download `stash-chrome-x.y.z.zip` from the
   [latest release](https://github.com/antonyshakirov/stash/releases/latest)
   and unzip it.
2. Open `chrome://extensions` and turn on Developer mode.
3. Press "Load unpacked" and pick the unzipped folder.

Updating is manual too. Unpacked extensions never update themselves — Chrome
has no mechanism for it — so download the new version and press Reload on the
same page.

### Firefox

[Install Stash](https://antonshakirov.com/stash/stash-latest.xpi) in one
click. The package is signed by Mozilla, so there is no store and no developer
mode, and it updates itself from there. Needs Firefox 140 or newer, which is
any Firefox updated since mid-2026.

Reload any open tabs after installing, since the extension does not reach tabs
that were already open.

## How it works

Open a post or a clip in full. In Instagram that is an address like `/p/…` or
`/reel/…`, in TikTok `/@author/video/…` or `/@author/photo/…`. A round button
appears in the bottom-right corner, and a second button with a musical note
shows up whenever there is sound to take.

Frames are saved one at a time. In a carousel, scroll to the slide you want
and press: exactly that one leaves. Three slides out of seven means three
presses.

There is deliberately no button in the feed or on the profile grid. What sits
under the cursor there is a thumbnail, and the file would come out worse than
the original, so open the post first.

Sound is extracted from the clip itself rather than taken from a ready-made
link, and it comes out exactly as long as the clip. Ten seconds of a song in a
reel means ten seconds in the file.

Saving the same frame twice does not create a duplicate: the extension
remembers what it already has and says so. Press a second time in a row if you
want the copy anyway.

## Where files go

| What | Where | Example |
|---|---|---|
| Clips | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Images | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Sound | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

The trailing number is the slide index in a carousel. An ordinary post has
none.

Folder names are yours to change: right-click the Stash icon in the toolbar
and choose Options. An empty field restores the default. A slash means
nesting, so `Refs/Saved Reels` puts one folder inside another. Characters that
a file system will not accept are cleaned up, and the page shows you the
result before you save it.

## What it does not do

Stash makes no requests to Instagram or TikTok of its own. It reads the data
the page has already received in order to show you the post, and when that
data is absent it says so instead of going to fetch it. Nothing is sent
anywhere: the file travels from the platform's CDN to the disk of the same
person who is looking at the post.

No signatures or protections are circumvented. No login is automated, no
account is touched, and no analytics are collected.

There is no batch downloading of a whole carousel, a profile or a saved
collection, no download queue, no history panel and no manual quality picker.
Sound is copied as it is, without re-encoding.

YouTube is not supported. It moved to a delivery scheme where file links are
no longer handed out at all, and supporting it would mean reimplementing their
own protocol.

## Rights and responsibility

Stash is not affiliated with or endorsed by Instagram, TikTok or Meta. Their
names appear here only to say where the extension works.

Rights to whatever you save belong to the people who posted it. This extension
grants no rights to anyone else's material and transfers none. Saving someone
else's work to look at it and collect references is one thing; republishing,
reuploading or using it commercially is another, and that is on the person who
saved it. Platform terms and copyright remain your responsibility.

## Build

```bash
npm test        # 88 tests
npm run build   # packages for both browsers into dist/
```

There is a single `manifest.json`, and it is also what Chrome loads unpacked.
The Firefox variant is derived from it in [scripts/build.py](scripts/build.py)
rather than kept as a second file, because two manifests would drift apart on
the first new permission.

Before submitting to Mozilla the package is checked with the official linter:

```bash
npx web-ext lint --source-dir dist/firefox --self-hosted
```

## Architecture

| File | Role |
|---|---|
| `src/lib/extract.js` | Pure functions: JSON traversal, quality choice, file names. Knows nothing about any platform. Covered by tests |
| `src/lib/sites/*.js` | Platform dictionaries: where the media sits and how to tell a post is open. Covered by tests |
| `src/lib/cache.js` | Per-tab cache of posts and slide indices |
| `src/lib/mp4audio.js` | Parses mp4 and repacks the audio track into m4a |
| `src/interceptor.js` | Runs in the page context and reads copies of responses the page received |
| `src/content/target.js` | Whether a post is open and what is currently on screen |
| `src/content/ui.js` | Buttons and toasts |
| `src/background.js` | Downloads, memory of what is saved, toolbar icon |
| `options/options.js` | Settings page for folder names |

The core knows no platforms: a new one is a new dictionary in
`src/lib/sites/`, not an edit to the traversal.

## Troubleshooting

**"Source not found"** — reload the page and press again. The extension reads
data the platform sends when the post loads, and after a long walk through
history it may be gone.

**No button on the post** — check that the post is open in full rather than
visible in the feed or as a tile in a profile.

**"Extension updated. Reload the page"** — the extension was reinstalled while
the tab was open. Press ⌘R.

Anything else: turn on debugging with `localStorage.stashDebug = '1'` and look
at the page console.

## License

[MIT](LICENSE). Open code, no warranty.
