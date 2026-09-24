# Fase 1 — Engine PPTX + halaman profil (mandiri)

Tidak ada file DMS produksi yang disentuh. Semua di folder ini.

## Berkas
| Berkas | Fungsi |
|---|---|
| `profil.html` | Halaman: muat data, edit progres, **tempel gambar (Ctrl+V)**, baki foto, rencana slide, buat PPTX |
| `profil-kit.js` | Helper (turunan `dms-shared.js`, namespace `ProfilKit`) |
| `profil-builders.js` | Data → *slide plan*: nilai tag, pagination kronologis merata, pembagi foto |
| `pptx-engine.js` | Template + plan → PPTX (salin slide, tag, grup baris, foto, tata letak tabel/teks) |
| `templates/` | `Template_Profil_Kegiatan.pptx` + `template_manifest.json` |
| `tests/` | `run_tests.js` (17 skenario), `smoke_page.js` (halaman di jsdom), `smoke_demo.js`, `check_outputs.sh` |
| `tools/build_demo.py` | Membuat `profil_demo.html` (semua tertanam) untuk uji di HP |

## Input gambar (permintaan: tanpa simpan-dulu)
- **Ctrl+V** di mana saja di halaman. Pilih penerima lewat chip: *Foto lapangan · Kurva S · Gambar rencana/3D · Foto kondisi awal · Foto kondisi berikutnya*.
- Sumber yang didukung: gambar dari PowerPoint (salin gambar), PDF (salin gambar / tangkapan layar), Excel (*Copy as Picture* untuk kurva S), Win+Shift+S. Juga seret-lepas, tombol **Tempel dari clipboard** (HP), dan pilih file (cadangan).
- Tiap gambar dikompres di browser (maks 1600 px, JPEG 0,82) dan foto kembar ditandai.
- Foto lapangan: *kelompok* + *keterangan* per foto, ★ sorotan (tampil di slide profil), urut naik/turun, hapus. "Kelompok aktif" otomatis dipasang ke foto yang baru ditempel.
- Catatan: kualitas gambar hasil tempel = kualitas yang ada di clipboard. Dari PDF, perbesar tampilan sebelum menyalin/menangkap agar tajam.

## Perilaku engine yang perlu diketahui
- **Kronologis:** 16 baris contoh muat 1 slide; lebih banyak dibagi merata (40 baris → 13/13/14).
- **Foto dokumentasi:** maks 6 per slide, dibagi merata dan diusahakan berhenti di batas kelompok (13 → 5/4/4). Foto ★ hanya tampil di slide profil.
- **Slide profil:** tinggi tabel spesifikasi mengikuti jumlah pihak/lingkup; tabel permasalahan menempel di dasar. Bila tidak muat, font tabel diperkecil bertahap (min 70%) dan halaman memberi peringatan.
- **Slide latar:** font 14 → 9 pt menyesuaikan panjang teks; kotak "Maksud dan Tujuan" turun otomatis.
- Baris/bentuk yang semua tag-nya kosong dibuang; slide tanpa isi (kronologis kosong, tanpa kurva S, tanpa foto) dilewati.

## Hasil uji (Node + jsdom + LibreOffice)
- 17 skenario (foto 0/1/2/5/6/7/13/25, kronologis 0/5/40, karakter khusus `& < > "`, tanpa luas/1 pihak/3 pihak, teks latar 4× panjang, tanpa kurva S): **semuanya lolos `validate.py`**, tanpa sisa tag.
- Uji properti pembagi foto: 640 kombinasi (1–80 foto × ukuran kelompok 1–8), 0 pelanggaran.
- Halaman di jsdom: muat data uji → Ctrl+V ke slot dan baki → ubah progres → buat PPTX: lolos.
- Bug nyata yang tertangkap validator saat pengembangan: penghapusan media yatim ikut menghapus semua media (folder `ppt/media/` terhitung entri). Sudah diperbaiki.

## Belum teruji (butuh Anda)
1. **PowerPoint desktop/HP**: dialog *repair*, tampilan tabel, posisi keterangan foto. LibreOffice lebih toleran.
2. **Clipboard nyata**: salin gambar dari PowerPoint/PDF/Excel lalu Ctrl+V di Chrome/Edge. Belum diuji: menyalin beberapa gambar sekaligus (kemungkinan browser hanya menerima satu gambar/komposit).
3. Kompresi foto berbasis canvas di HP dengan foto kamera besar (jsdom tidak punya canvas).
4. Kalibrasi tinggi tabel di PowerPoint (estimasi memakai spasi baris 115% seperti tabel contoh; tabel spesifikasi contoh terhitung 2,97 juta EMU di PowerPoint, estimasi engine 2,98 juta).

## Menjalankan
```
npm i                       # pizzip, @xmldom/xmldom, image-size (+ jsdom untuk smoke test)
node tests/run_tests.js     # 17 skenario -> tests/out/*.pptx
bash tests/check_outputs.sh tests/out templates/Template_Profil_Kegiatan.pptx
```
`profil.html` butuh server statis (mis. Live Server), bukan `file://`, karena memuat template lewat `fetch`.

PizZip disertakan lokal di `libs/` (bukan CDN). Pada uji pertama di HP, demo yang memuat PizZip dari CDN gagal (`env.PizZip is not a constructor`); sejak itu PizZip ditanam langsung dan engine memberi pesan jelas bila pustaka tidak termuat.
