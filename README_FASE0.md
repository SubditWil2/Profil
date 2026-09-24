# Fase 0 — Template Profil Kegiatan (selesai)

## Isi folder
| Path | Fungsi |
|---|---|
| `templates/Template_Profil_Kegiatan.pptx` | 7 slide prototipe bertag (2,4 MB; deck contoh 69 MB) |
| `templates/template_manifest.json` | Kontrak template: tag wajib per slide, slot, area, aturan |
| `sample_data/pohuwato.json` + `photos/` | Data uji dari deck contoh (16 baris kronologis + 2 baris pengecoh, 19 foto) |
| `sample_data/preview_teks_terisi.pptx` | Template terisi **teks saja** (foto belum, itu Fase 1) |
| `tools/` | Skrip Python untuk membangun ulang dan memeriksa template (khusus development) |

## Membangun ulang / memeriksa
```
./tools/make_template.sh Profil_Pembangunan_Kantor_Bupati_Pohuwato.pptx /path/mutlak/Template_Profil_Kegiatan.pptx
python3 tools/check_template.py templates/Template_Profil_Kegiatan.pptx templates/template_manifest.json
```
`make_template.sh` memanggil `clean.py` dari skill pptx di lingkungan ini; di komputer lain jalur itu perlu disesuaikan.

## Yang berubah dari deck contoh
1. Slide 7 (dokumentasi kedua) dibuang; slide 6 menjadi satu-satunya prototipe dokumentasi.
2. Slide 2: objek tertaut Excel di SharePoint diganti tabel native `tbl:kron` (header + 1 baris contoh; 9 pt).
3. Foto, gambar, dan keterangan contoh dibuang; diganti slot (`img:*`), area (`area:foto`), dan prototipe gaya (`proto:caption`, di luar kanvas).
4. Media cover dan penutup dikompres (PNG 5 MB dan 23 MB → JPEG); efek gambar cadangan `hdphoto` (3,9 MB) dibuang.
5. Slide 4: label "Design 3D" yang tertutup gambar dan 8 bintik putih sisa logo dibuang; font tema/`Neue Haas Grotesk` → Arial.
6. Slide 3: dua foto dalam grup ber-skala dibongkar menjadi dua slot ber-koordinat absolut; alt text sisa judul berita ikut hilang.

## Temuan pada deck contoh (untuk diketahui)
- Slide 6 dan 7 memakai file foto yang **sama** untuk beberapa keterangan berbeda (mis. "A2 Tampak Samping" dan "A2 Tampak Belakang"). Kemungkinan foto sementara; deteksi foto kembar (hash) layak ditambahkan di form.
- Salah ketik pada data: "terambat", "pancnag".
- Tanggal cover (3 Agustus) berbeda dari tanggal status (16 Agustus); di data uji keduanya memakai tanggal status.
- Nilai kontrak konsultan tertulis `Rp. 1.079,968.728`; di data uji diasumsikan `1.079.968.728`.

## Hasil uji Fase 0
- `validate.py` (skill pptx, dibandingkan dengan deck asal): lolos.
- `check_template.py`: 0 error, 0 peringatan.
- Pengisian teks: masa pelaksanaan terhitung 217 hari (sama dengan contoh), deviasi fisik −3,95, filter kronologis menyaring 2 baris pengecoh (provinsi lain dan tidak ditandai), 16 baris tersusun urut tanggal dan muat 1 slide.
- Belum diuji: pembukaan di **PowerPoint desktop** (LibreOffice lebih toleran).

## Fase 1 (berikutnya)
`pptx-engine.js` (salin slide, isi tag, grup baris, list paragraf, slot/area foto, tulis ZIP) + `profil-builders.js` + `profil.html` minimum dengan tombol Unduh, memakai `pohuwato.json` sebagai data.
