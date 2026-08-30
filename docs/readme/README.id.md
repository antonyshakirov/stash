<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Menyimpan satu bingkai, klip, atau suaranya dari Instagram dan TikTok dengan sekali klik. Ekstensi peramban kecil untuk mengumpulkan referensi.**

[![Rilis terbaru](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Lisensi](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Peramban](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

**Bahasa Indonesia** · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · [Tiếng Việt](README.vi.md) · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Buka sebuah unggahan dan tombol bundar muncul di sudut. Sekali tekan, apa pun yang ada di layar masuk ke folder unduhan Anda. Sebatas itulah alat ini.

## Pemasangan

### Chrome

Chrome tidak mengizinkan pemasangan ekstensi dari luar tokonya sendiri, dan toko itu tidak menerbitkan ekstensi jenis ini. Karena itu pemasangannya manual:

1. Unduh `stash-chrome-x.y.z.zip` dari [rilis terbaru](https://github.com/antonyshakirov/stash/releases/latest) lalu ekstrak.
2. Buka `chrome://extensions` dan nyalakan mode pengembang.
3. Tekan «Muat yang belum dipaketkan» dan pilih folder hasil ekstrak.

Pembaruannya juga manual. Ekstensi yang belum dipaketkan tidak pernah memperbarui dirinya sendiri — Chrome tidak punya mekanisme untuk itu. Unduh versi baru lalu tekan «Muat ulang» di halaman yang sama.

### Firefox

[Pasang Stash](https://antonshakirov.com/stash/stash-latest.xpi) dengan sekali klik. Paketnya ditandatangani Mozilla, jadi tidak perlu toko maupun mode pengembang, dan ia memperbarui dirinya sendiri. Perlu Firefox 140 atau lebih baru.

Muat ulang tab yang sudah terbuka setelah pemasangan: ekstensi tidak menjangkaunya.

## Cara kerjanya

Buka unggahan atau klip secara penuh. Di Instagram alamatnya seperti `/p/…` atau `/reel/…`, di TikTok `/@penulis/video/…` atau `/@penulis/photo/…`. Tombol bundar muncul di kanan bawah, dan di sebelahnya tombol bernot balok bila ada suara yang bisa diambil.

Bingkai disimpan satu per satu. Pada korsel, gulir ke slide yang Anda mau lalu tekan: persis itu yang tersimpan. Tiga slide dari tujuh berarti tiga kali tekan.

Di beranda dan di kisi profil sengaja tidak ada tombol. Yang ada di bawah kursor di sana adalah gambar mini, dan berkasnya akan lebih buruk daripada aslinya.

Suara diambil dari klip itu sendiri dan panjangnya persis sama dengan klipnya. Sepuluh detik lagu di klip berarti sepuluh detik di berkas.

Menyimpan bingkai yang sama dua kali tidak membuat duplikat: ekstensi mengingat apa yang sudah ada dan mengatakannya. Kalau salinannya tetap Anda inginkan, tekan sekali lagi berturut-turut.

## Ke mana berkas disimpan

| Apa | Ke mana | Contoh nama |
|---|---|---|
| Klip | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Gambar | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Suara | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Angka di akhir adalah nomor slide dalam korsel. Unggahan biasa tidak memilikinya.

Nama folder bisa diubah: klik kanan ikon Stash di bilah lalu pilih «Opsi». Bidang kosong mengembalikan nama bawaan. Garis miring berarti bersarang: `Refs/Saved Reels` menaruh folder di dalam folder.

## Yang tidak dilakukan Stash

Stash tidak mengirim satu pun permintaan atas inisiatifnya sendiri ke Instagram atau TikTok. Ekstensi membaca data yang memang sudah diterima halaman untuk menampilkan unggahan, dan ketika data itu tidak ada, ia mengatakannya alih-alih pergi mengambilnya. Tidak ada yang dikirim ke mana pun: berkas berjalan dari CDN platform ke cakram orang yang sedang melihat unggahan itu juga.

Tidak ada tanda tangan atau proteksi yang ditembus, tidak ada proses masuk yang diotomatiskan, tidak ada akun orang lain yang disentuh, dan tidak ada statistik yang dikumpulkan.

Tidak ada pengunduhan massal korsel, profil, atau koleksi, tidak ada antrean unduhan, dan tidak ada pemilihan kualitas secara manual. Suara disalin apa adanya.

YouTube tidak didukung.

## Hak dan tanggung jawab

Stash tidak berafiliasi dengan Instagram, TikTok, atau Meta dan tidak disetujui oleh mereka. Nama-nama itu muncul di sini hanya untuk menyebutkan di mana ekstensi ini bekerja.

Hak atas apa pun yang Anda simpan dimiliki oleh orang yang mengunggahnya. Ekstensi ini tidak memberikan hak apa pun atas karya orang lain. Menyimpan karya orang lain untuk dilihat dan dijadikan referensi adalah satu hal; menerbitkannya ulang atau memakainya secara komersial adalah hal lain, dan itu tanggung jawab orang yang menyimpannya.

## Selengkapnya

Pembangunan, arsitektur kode, dan penanganan masalah ada di [README bahasa Inggris](../../README.md).

## Lisensi

[MIT](../../LICENSE).
