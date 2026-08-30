<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Zapisuje kadr, klip albo jego dźwięk z Instagrama i TikToka jednym kliknięciem. Małe rozszerzenie przeglądarki do zbierania referencji.**

[![Najnowsza wersja](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Licencja](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Przeglądarki](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · **Polski** · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Otwórz post, a w rogu pojawi się okrągły przycisk. Naciśnięcie odkłada to, co jest na ekranie, do folderu pobranych. Na tym całe narzędzie się kończy.

## Instalacja

### Chrome

Chrome nie pozwala instalować rozszerzeń spoza własnego sklepu, a ten sklep nie publikuje rozszerzeń tego rodzaju. Instalacja odbywa się więc ręcznie:

1. Pobierz `stash-chrome-x.y.z.zip` z [najnowszego wydania](https://github.com/antonyshakirov/stash/releases/latest) i rozpakuj.
2. Otwórz `chrome://extensions` i włącz tryb dewelopera.
3. Kliknij «Załaduj rozpakowane» i wskaż rozpakowany folder.

Aktualizacja też jest ręczna. Rozpakowane rozszerzenia nigdy nie aktualizują się same — Chrome nie ma do tego żadnego mechanizmu. Pobierz nową wersję i kliknij «Odśwież» na tej samej stronie.

### Firefox

[Zainstaluj Stash](https://antonshakirov.com/stash/stash-latest.xpi) jednym kliknięciem. Pakiet jest podpisany przez Mozillę, więc nie trzeba ani sklepu, ani trybu dewelopera, a aktualizuje się sam. Wymaga Firefoksa 140 lub nowszego.

Po instalacji odśwież otwarte karty: rozszerzenie do nich nie dociera.

## Jak to działa

Otwórz post albo klip w całości. Na Instagramie to adres w rodzaju `/p/…` lub `/reel/…`, na TikToku `/@autor/video/…` albo `/@autor/photo/…`. Na dole po prawej pojawia się okrągły przycisk, a obok przycisk z nutą, gdy jest dźwięk do wzięcia.

Kadry zapisują się pojedynczo. W karuzeli przewiń do wybranego slajdu i naciśnij: wyjedzie dokładnie ten. Trzy slajdy z siedmiu to trzy naciśnięcia.

Na tablicy i w siatce profilu przycisku celowo nie ma. Pod kursorem leży tam miniatura, a plik wyszedłby gorzej niż oryginał.

Dźwięk jest wyjmowany z samego klipu i trwa dokładnie tyle co on. Dziesięć sekund piosenki w klipie to dziesięć sekund w pliku.

Dwukrotny zapis tego samego kadru nie tworzy duplikatu: rozszerzenie pamięta, co już ma, i o tym mówi. Jeśli kopia mimo to jest potrzebna, naciśnij drugi raz z rzędu.

## Gdzie trafiają pliki

| Co | Gdzie | Przykładowa nazwa |
|---|---|---|
| Klipy | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Obrazy | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Dźwięk | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Liczba na końcu to numer slajdu w karuzeli. Zwykły post jej nie ma.

Nazwy folderów można zmienić: kliknij prawym przyciskiem ikonę Stash na pasku i wybierz «Opcje». Puste pole przywraca nazwę domyślną. Ukośnik oznacza zagnieżdżenie: `Refs/Saved Reels` umieszcza folder w folderze.

## Czego Stash nie robi

Stash nie wysyła z własnej inicjatywy ani jednego żądania do Instagrama czy TikToka. Rozszerzenie czyta dane, które strona i tak otrzymała, żeby pokazać ci post, a gdy ich nie ma, mówi o tym zamiast po nie iść. Nic nigdzie nie jest wysyłane: plik jedzie z CDN platformy na dysk tej samej osoby, która ogląda post.

Żadne podpisy ani zabezpieczenia nie są obchodzone, żadne logowanie nie jest automatyzowane, cudze konta nie są ruszane, statystyki nie są zbierane.

Nie ma masowego pobierania karuzeli, profili ani kolekcji, nie ma kolejki pobierania ani ręcznego wyboru jakości. Dźwięk kopiowany jest bez zmian.

YouTube nie jest obsługiwany.

## Prawa i odpowiedzialność

Stash nie jest powiązany z Instagramem, TikTokiem ani Metą i nie ma ich aprobaty. Ich nazwy pojawiają się tu tylko po to, by powiedzieć, gdzie rozszerzenie działa.

Prawa do tego, co zapiszesz, należą do tych, którzy to opublikowali. To rozszerzenie nie daje żadnych praw do cudzego materiału. Zapisać czyjąś pracę, żeby ją oglądać i zbierać referencje, to jedno; opublikować ją ponownie albo wykorzystać komercyjnie to co innego, i odpowiada za to ten, kto zapisał.

## Więcej

Budowanie, budowa kodu i rozwiązywanie problemów są w [README po angielsku](../../README.md).

## Licencja

[MIT](../../LICENSE).
