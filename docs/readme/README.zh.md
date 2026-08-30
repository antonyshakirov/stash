<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**一键保存 Instagram 和 TikTok 上的图片、视频或其声音。一个用来收集参考素材的小型浏览器扩展。**

[![最新版本](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![许可协议](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![浏览器](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · **中文** · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

打开一条帖子，角落里会出现一个圆形按钮。按一下，屏幕上的东西就落进你的下载文件夹。这个工具就这么多。

## 安装

### Chrome

Chrome 不允许从自家商店之外安装扩展，而那家商店又不发布这一类扩展。因此只能手动安装：

1. 从[最新发布](https://github.com/antonyshakirov/stash/releases/latest)下载 `stash-chrome-x.y.z.zip` 并解压。
2. 打开 `chrome://extensions`，开启开发者模式。
3. 点击「加载已解压的扩展程序」，选择解压后的文件夹。

更新同样要手动。已解压的扩展从不自我更新——Chrome 根本没有这样的机制。下载新版本，然后在同一页面点击「重新加载」。

### Firefox

[安装 Stash](https://antonshakirov.com/stash/stash-latest.xpi)，一次点击即可。安装包由 Mozilla 签名，因此既不需要商店也不需要开发者模式，此后会自行更新。需要 Firefox 140 或更新版本。

安装后请刷新已经打开的标签页：扩展到不了那里。

## 工作方式

把帖子或视频完整打开。在 Instagram 上是形如 `/p/…` 或 `/reel/…` 的地址，在 TikTok 上是 `/@作者/video/…` 或 `/@作者/photo/…`。右下角会出现一个圆形按钮，若有声音可取，旁边还会出现一个音符按钮。

图片一次保存一张。如果是轮播，翻到想要的那一张再按，走的正是那一张。七张里要三张，就按三次。

信息流和主页网格里刻意没有按钮。那里光标下面是缩略图，存出来的文件会比原图差。

声音是从视频本身取出的，长度与视频完全一致。视频里有十秒歌，文件里就是十秒。

同一张图片保存两次不会产生重复：扩展记得自己已有什么，并会告诉你。若仍然想要副本，连着再按一次。

## 文件存到哪里

| 内容 | 位置 | 文件名示例 |
|---|---|---|
| 视频 | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| 图片 | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| 声音 | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

末尾的数字是轮播中的图片序号。普通帖子没有这个数字。

文件夹名称可以更改：右键点击工具栏上的 Stash 图标，选择「选项」。留空即恢复默认名称。斜杠表示嵌套，`Refs/Saved Reels` 会把一个文件夹放进另一个文件夹。

## Stash 不做的事

Stash 从不主动向 Instagram 或 TikTok 发送任何请求。扩展只读取页面为了给你显示帖子而本来就已收到的数据；数据不在时，它会直说，而不是去取。没有任何东西被发往任何地方：文件从平台的 CDN 直接到正在看这条帖子的人的磁盘上。

不绕过任何签名或保护，不自动化登录，不触碰他人账号，不收集统计。

没有整批下载轮播、主页或收藏夹的功能，没有下载队列，也没有手动选择画质。声音按原样复制。

不支持 YouTube。

## 权利与责任

Stash 与 Instagram、TikTok 或 Meta 无关，也未获得它们的认可。这些名称出现在这里，只是为了说明扩展在哪里工作。

你所保存内容的权利属于发布它的人。本扩展不授予任何他人素材的权利。保存别人的作品用来观看和收集参考是一回事；重新发布或作商业用途是另一回事，责任在保存的人。

## 更多

构建、代码结构与故障排查见[英文 README](../../README.md)。

## 许可协议

[MIT](../../LICENSE).
