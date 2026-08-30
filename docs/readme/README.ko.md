<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Instagram과 TikTok의 사진, 영상, 그 소리를 한 번의 클릭으로 저장합니다. 레퍼런스를 모으기 위한 작은 브라우저 확장 프로그램입니다.**

[![최신 릴리스](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![라이선스](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![브라우저](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · **한국어**

</div>

게시물을 열면 모서리에 둥근 버튼이 나타납니다. 누르면 지금 화면에 있는 것이 다운로드 폴더로 들어갑니다. 이 도구는 그게 전부입니다.

## 설치

### Chrome

Chrome은 자체 스토어 밖에서 확장 프로그램을 설치하는 것을 허용하지 않고, 그 스토어는 이런 종류의 확장 프로그램을 게시하지 않습니다. 그래서 설치는 수동입니다.

1. [최신 릴리스](https://github.com/antonyshakirov/stash/releases/latest)에서 `stash-chrome-x.y.z.zip`을 내려받아 압축을 풉니다.
2. `chrome://extensions`를 열고 개발자 모드를 켭니다.
3. «압축해제된 확장 프로그램을 로드합니다»를 누르고 압축을 푼 폴더를 고릅니다.

업데이트도 수동입니다. 압축해제된 확장 프로그램은 결코 스스로 업데이트되지 않습니다. Chrome에 그런 장치가 없기 때문입니다. 새 버전을 내려받고 같은 페이지에서 «새로고침»을 누르세요.

### Firefox

[Stash 설치](https://antonshakirov.com/stash/stash-latest.xpi)는 한 번의 클릭이면 됩니다. 패키지는 Mozilla가 서명했으므로 스토어도 개발자 모드도 필요 없고, 이후에는 스스로 업데이트됩니다. Firefox 140 이상이 필요합니다.

설치한 뒤에는 이미 열려 있던 탭을 새로고침하세요. 확장 프로그램은 그곳까지 닿지 않습니다.

## 작동 방식

게시물이나 영상을 전체로 엽니다. Instagram에서는 `/p/…` 또는 `/reel/…` 형태의 주소이고, TikTok에서는 `/@작성자/video/…` 또는 `/@작성자/photo/…`입니다. 오른쪽 아래에 둥근 버튼이 나타나고, 가져올 소리가 있으면 그 옆에 음표 버튼이 생깁니다.

이미지는 하나씩 저장됩니다. 캐러셀이라면 원하는 슬라이드까지 넘긴 뒤 누르면 바로 그것이 저장됩니다. 일곱 장 중 세 장이면 세 번 누릅니다.

피드와 프로필 격자에는 일부러 버튼을 두지 않았습니다. 그곳에서 커서 아래에 있는 것은 축소판이라 파일이 원본보다 나빠지기 때문입니다.

소리는 영상 자체에서 꺼내며 길이는 영상과 정확히 같습니다. 영상에 노래가 십 초 들어 있으면 파일도 십 초입니다.

같은 이미지를 두 번 저장해도 중복은 생기지 않습니다. 확장 프로그램은 이미 가진 것을 기억하고 그렇게 알려 줍니다. 그래도 사본이 필요하면 연달아 한 번 더 누르세요.

## 파일이 저장되는 곳

| 무엇 | 어디에 | 이름 예시 |
|---|---|---|
| 영상 | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| 이미지 | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| 소리 | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

끝의 숫자는 캐러셀 안의 슬라이드 번호입니다. 일반 게시물에는 없습니다.

폴더 이름은 바꿀 수 있습니다. 도구 모음의 Stash 아이콘을 오른쪽 클릭하고 «옵션»을 고르세요. 빈 칸으로 두면 기본 이름으로 돌아갑니다. 빗금은 중첩을 뜻해서 `Refs/Saved Reels`는 폴더 안에 폴더를 만듭니다.

## Stash가 하지 않는 것

Stash는 스스로 Instagram이나 TikTok에 단 한 번의 요청도 보내지 않습니다. 확장 프로그램은 페이지가 게시물을 보여 주려고 이미 받아 둔 데이터를 읽을 뿐이며, 그 데이터가 없을 때는 가지러 가는 대신 그렇다고 말합니다. 아무것도 어디로도 전송되지 않습니다. 파일은 플랫폼의 CDN에서 그 게시물을 보고 있는 사람의 디스크로 갑니다.

어떤 서명이나 보호도 우회하지 않고, 로그인을 자동화하지 않으며, 남의 계정을 건드리지 않고, 통계를 수집하지 않습니다.

캐러셀이나 프로필, 컬렉션의 일괄 다운로드는 없습니다. 다운로드 대기열도, 화질을 손으로 고르는 기능도 없습니다. 소리는 있는 그대로 복사됩니다.

YouTube는 지원하지 않습니다.

## 권리와 책임

Stash는 Instagram, TikTok, Meta와 무관하며 그들의 승인을 받지 않았습니다. 이름이 여기 나오는 것은 확장 프로그램이 어디에서 작동하는지 말하기 위해서일 뿐입니다.

저장한 것의 권리는 그것을 올린 사람에게 있습니다. 이 확장 프로그램은 남의 자료에 대한 어떤 권리도 주지 않습니다. 남의 작업을 저장해 두고 보며 레퍼런스로 모으는 것과, 그것을 다시 게시하거나 상업적으로 쓰는 것은 다른 일이며, 그 책임은 저장한 사람에게 있습니다.

## 더 보기

빌드, 코드 구조, 문제 해결은 [영문 README](../../README.md)에 있습니다.

## 라이선스

[MIT](../../LICENSE).
