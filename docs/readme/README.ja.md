<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Instagram と TikTok の写真・動画・その音声をワンクリックで保存します。参考資料を集めるための小さなブラウザ拡張機能です。**

[![最新リリース](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![ライセンス](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![ブラウザ](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · **日本語** · [한국어](README.ko.md)

</div>

投稿を開くと隅に丸いボタンが現れます。押せば、いま画面にあるものがダウンロードフォルダに入ります。この道具はそれだけです。

## インストール

### Chrome

Chrome は自社ストア以外からの拡張機能のインストールを許可しておらず、そのストアはこの種の拡張機能を公開していません。そのため手動でのインストールになります。

1. [最新リリース](https://github.com/antonyshakirov/stash/releases/latest)から `stash-chrome-x.y.z.zip` をダウンロードして展開します。
2. `chrome://extensions` を開き、デベロッパーモードをオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」を押し、展開したフォルダを選びます。

更新も手動です。パッケージ化されていない拡張機能が自動で更新されることはありません。Chrome にその仕組みがないからです。新しい版をダウンロードし、同じページで「更新」を押してください。

### Firefox

[Stash をインストール](https://antonshakirov.com/stash/stash-latest.xpi)。ワンクリックで済みます。パッケージは Mozilla の署名付きなので、ストアもデベロッパーモードも不要で、以後は自動で更新されます。Firefox 140 以降が必要です。

インストール後は開いていたタブを再読み込みしてください。拡張機能はそこには届きません。

## 使い方

投稿や動画を全画面で開きます。Instagram なら `/p/…` や `/reel/…` のようなアドレス、TikTok なら `/@作者/video/…` や `/@作者/photo/…` です。右下に丸いボタンが現れ、取れる音声があるときはその隣に音符のボタンが出ます。

画像は一枚ずつ保存されます。カルーセルなら目的のスライドまでめくって押せば、まさにそれが保存されます。七枚のうち三枚なら三回押します。

フィードとプロフィールのグリッドには意図的にボタンがありません。そこでカーソルの下にあるのはサムネイルで、ファイルは元より劣ってしまうからです。

音声は動画そのものから取り出され、長さは動画とぴったり同じになります。動画に曲が十秒入っていれば、ファイルも十秒です。

同じ画像を二度保存しても重複はできません。拡張機能はすでに持っているものを覚えていて、そう伝えます。それでも複製が欲しいときは、続けてもう一度押してください。

## ファイルの保存先

| 種類 | 保存先 | ファイル名の例 |
|---|---|---|
| 動画 | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| 画像 | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| 音声 | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

末尾の数字はカルーセル内のスライド番号です。通常の投稿には付きません。

フォルダ名は変更できます。ツールバーの Stash アイコンを右クリックして「オプション」を選んでください。空欄にすると既定の名前に戻ります。スラッシュは入れ子を意味し、`Refs/Saved Reels` はフォルダの中にフォルダを作ります。

## Stash がしないこと

Stash は Instagram や TikTok へ自分から一度もリクエストを送りません。拡張機能は、ページが投稿を表示するためにすでに受け取ったデータを読むだけで、それが無いときは取りに行かずにそう伝えます。どこにも何も送信されません。ファイルはプラットフォームの CDN から、その投稿を見ている本人のディスクへ届きます。

署名や保護を回避することはなく、ログインを自動化することもなく、他人のアカウントに触れることもなく、統計を集めることもありません。

カルーセルやプロフィール、コレクションの一括ダウンロードはありません。ダウンロードの待ち行列も、画質の手動選択もありません。音声はそのまま複製されます。

YouTube には対応していません。

## 権利と責任

Stash は Instagram、TikTok、Meta とは無関係であり、承認も受けていません。名前がここに出てくるのは、拡張機能がどこで動くかを述べるためだけです。

保存したものの権利は、それを投稿した人のものです。この拡張機能は他人の素材に対する権利を一切与えません。他人の作品を保存して眺め、参考資料として集めることと、それを再公開したり商業利用したりすることは別であり、その責任は保存した人にあります。

## さらに

ビルド、コードの構成、トラブルシューティングは[英語版 README](../../README.md) にあります。

## ライセンス

[MIT](../../LICENSE).
