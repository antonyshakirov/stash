<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Instagram ve TikTok'tan bir kareyi, klibi ya da sesini tek tıkla kaydeder. Referans toplamak için küçük bir tarayıcı eklentisi.**

[![Son sürüm](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Lisans](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Tarayıcılar](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · **Türkçe** · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Bir gönderiyi açın, köşede yuvarlak bir düğme belirir. Basınca ekranda ne varsa indirilenler klasörünüze düşer. Aracın tamamı bu.

## Kurulum

### Chrome

Chrome kendi mağazasının dışından eklenti kurulmasına izin vermiyor ve o mağaza bu türden eklentileri yayımlamıyor. Bu yüzden kurulum elle yapılıyor:

1. [Son sürümden](https://github.com/antonyshakirov/stash/releases/latest) `stash-chrome-x.y.z.zip` dosyasını indirin ve açın.
2. `chrome://extensions` adresini açın ve geliştirici modunu etkinleştirin.
3. «Paketlenmemiş öğe yükle» düğmesine basın ve açtığınız klasörü seçin.

Güncelleme de elle yapılıyor. Paketlenmemiş eklentiler kendilerini hiçbir zaman güncellemez — Chrome'un böyle bir düzeneği yok. Yeni sürümü indirin ve aynı sayfada «Yenile» düğmesine basın.

### Firefox

[Stash'i kurun](https://antonshakirov.com/stash/stash-latest.xpi) tek tıkla. Paket Mozilla tarafından imzalı, yani ne mağaza ne de geliştirici modu gerekiyor, üstelik kendini güncelliyor. Firefox 140 veya üstü gerekir.

Kurulumdan sonra açık sekmeleri yenileyin: eklenti onlara ulaşmaz.

## Nasıl çalışır

Gönderiyi ya da klibi tam olarak açın. Instagram'da bu `/p/…` veya `/reel/…` biçiminde bir adres, TikTok'ta `/@yazar/video/…` ya da `/@yazar/photo/…`. Sağ altta yuvarlak bir düğme belirir, yanında da alınacak ses varsa nota işaretli bir düğme.

Kareler teker teker kaydedilir. Karuselde istediğiniz slayta kaydırıp basın: tam olarak o gider. Yediden üç slayt demek üç basış demek.

Akışta ve profil ızgarasında düğme bilerek yok. Orada imlecin altındaki küçük bir önizleme ve dosya aslından kötü çıkardı.

Ses klibin kendisinden çıkarılır ve tam olarak klip kadar sürer. Klipte bir şarkının on saniyesi varsa dosyada da on saniye olur.

Aynı kareyi iki kez kaydetmek kopya oluşturmaz: eklenti neyi zaten aldığını hatırlar ve söyler. Kopyayı yine de istiyorsanız arka arkaya ikinci kez basın.

## Dosyalar nereye gider

| Ne | Nereye | Örnek ad |
|---|---|---|
| Klipler | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Görseller | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Ses | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Sondaki sayı karuseldeki slaydın numarasıdır. Sıradan bir gönderide bulunmaz.

Klasör adları değiştirilebilir: çubuktaki Stash simgesine sağ tıklayıp «Seçenekler»i seçin. Boş bırakılan alan varsayılan adı geri getirir. Eğik çizgi iç içeliği anlatır: `Refs/Saved Reels` bir klasörü başka bir klasörün içine koyar.

## Stash'in yapmadıkları

Stash kendiliğinden Instagram'a ya da TikTok'a tek bir istek bile göndermez. Eklenti, sayfanın gönderiyi size göstermek için zaten aldığı veriyi okur; veri yoksa gidip almak yerine bunu söyler. Hiçbir şey hiçbir yere gönderilmez: dosya platformun CDN'inden, gönderiye bakan kişinin diskine gider.

Hiçbir imza ya da koruma aşılmaz, hiçbir oturum açma otomatikleştirilmez, başkasının hesabına dokunulmaz, istatistik toplanmaz.

Karuselleri, profilleri ya da koleksiyonları toplu indirme yok, indirme kuyruğu yok, elle kalite seçimi yok. Ses olduğu gibi kopyalanır.

YouTube desteklenmiyor.

## Haklar ve sorumluluk

Stash'in Instagram, TikTok veya Meta ile bağı yoktur ve onlar tarafından onaylanmamıştır. Adları burada yalnızca eklentinin nerede çalıştığını söylemek için geçiyor.

Kaydettiğiniz şeyin hakları onu paylaşan kişilere aittir. Bu eklenti başkasının malzemesi üzerinde hiçbir hak vermez. Birinin işini bakmak ve referans toplamak için kaydetmek başka şeydir; yeniden yayımlamak ya da ticari olarak kullanmak başka, ve bunun sorumlusu kaydeden kişidir.

## Daha fazlası

Derleme, kodun yapısı ve sorun giderme [İngilizce README](../../README.md) içinde.

## Lisans

[MIT](../../LICENSE).
