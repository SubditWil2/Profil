# Fase 3 — Profil dasar per kegiatan, gambar statis, salin laporan lalu, Rapikan AI

Sisi kode selesai dan lolos uji dengan flow tiruan. Membutuhkan flow **BacaProfil** dan tambahan pada **SimpanProfil** (docs/FLOW_SimpanProfil.md bagian 7) sebelum bisa dipakai sungguhan.

| Berkas | Fungsi |
|---|---|
| `profil-master.js` | Profil dasar ↔ baris Excel `ProfilKegiatan`; gambar statis (`design3d`, `pra`, `pasca`) ↔ folder `_aset`; membaca balasan `BacaProfil` |
| `profil-ai.js` | "Rapikan dengan AI" (Gemini, rotasi model/kunci); larangan menambah fakta; peringatan bila angka berubah |
| `profil.html` | Profil dasar & gambar statis terisi otomatis saat kegiatan dipilih; tombol *Salin angka & catatan dari laporan …*; kotak *Simpan profil dasar sebagai default*; tombol ✨ pada latar belakang, maksud, permasalahan, tindak lanjut |

## Perbaikan pada rilis ini
- **Error 401 "OAuth authorization scheme is required"**: trigger HTTP flow baru diset *Any user in my tenant* (URL tanpa `sig=`). Ubah ke *Anyone*, simpan, salin ulang URL. Halaman sekarang mendeteksi URL tanpa `sig=` sebelum mengirim dan menjelaskan langkahnya saat menerima 401/403.
- **Ctrl+V di kolom teks**: menempel teks (latar belakang, maksud, dll.) tidak lagi dicegat sebagai gambar walau clipboard juga berisi gambar (kasus salin dari PowerPoint/Word). Tempel gambar-saja tetap ditangkap.

## Hasil uji
- `test_master_ai.js`: 17 pemeriksaan (serialisasi bolak-balik, parsing balasan, aset diizinkan, AI: rotasi kunci, galat, pembersihan markdown).
- `smoke_month2.js` (kriteria Fase 3): sesi 1 mengisi & menyimpan sebagai default; sesi 2 (halaman baru) hanya mengisi data periodik → deck lengkap; payload kedua tanpa master/aset (5 MB vs lebih besar); dua laporan tercatat.
- Regresi Fase 1–2 tetap lolos.

## Belum diperbaiki (dicatat, menunggu giliran)
Tampilan: dropdown/popup belum didesain, modal belum senada dengan halaman DMS lain.
