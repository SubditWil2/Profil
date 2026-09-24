# Fase 2 — Data live DMS + simpan ke OneDrive

Masih mandiri: tidak ada file DMS produksi yang diubah. `GetMasterData` hanya **dibaca**; penyimpanan lewat flow dan tabel Excel **baru**.

## Yang baru
| Berkas | Fungsi |
|---|---|
| `profil-live.js` | Membaca respons `GetMasterData` (kunci bervariasi, `masterKegiatanGabungan` berformat `][`), cache sendiri `profil_dev_cache` |
| `profil-save.js` | Path folder `H. Profil Kegiatan`, nama file, snapshot, payload, kirim ke flow (timeout, pesan galat flow) |
| `profil-config.js` | `getDataFlowUrl` (flow yang sudah ada), `saveFlowUrl` (**kosong sampai flow dibuat**), batas ukuran, daftar pembuat |
| `docs/FLOW_SimpanProfil.md` | Panduan membuat flow `SimpanProfil` + tabel Excel `ProfilProgres` (skema trigger, langkah, validasi jalur) |
| `profil.html` | Kartu Kegiatan (Provinsi → Kegiatan dari DMS), Profil dasar, kronologis dengan centang pengecualian, tombol Simpan ke OneDrive, unduh draf JSON |
| `tests/` | `test_live_save.js`, `smoke_live.js`, `mock_flow.js` (flow tiruan), `make_payload.js` (payload uji untuk flow asli) |

## Perilaku
- **Kronologis live:** dokumen bertanda `IsKronologis = Ya` dengan **Provinsi + Nama Kegiatan** sama (bukan hanya nama kegiatan seperti `kronologis.html` sekarang), urut tanggal. Baris bisa dikecualikan lewat centang; yang dikecualikan ikut tersimpan di snapshot.
- **Simpan** hanya aktif bila: flow terkonfigurasi, data DMS termuat (agar kegiatan terbukti terdaftar), dan pembuat dipilih. Kegiatan baru/tidak terdaftar dan `19. Kegiatan Lainnya` ditolak.
- **Kirim:** konfirmasi dulu (path, nama file, jumlah slide, ukuran). Kiriman di atas `maxPayloadMB` ditolak sebelum dikirim.
- **Jalur galat:** pesan galat dari flow ditampilkan apa adanya; timeout ditangani.

## Hasil uji (Node, jsdom, flow tiruan)
- `test_live_save.js`: 25 pemeriksaan (parsing data live, penyaringan pengecoh, kunci Gemini, cache, render dengan data live, payload, kirim, 6 jalur galat).
- `smoke_live.js`: halaman utuh — muat DMS → pilih kegiatan → isi profil dasar & progres → tempel kurva S & foto → buat PPTX → simpan ke flow tiruan → 2 kondisi tombol Simpan nonaktif.
- Regresi Fase 1: 17 skenario engine tetap lolos `validate.py`.

## Temuan
- Normalisasi nama kolom di `dms-shared.js`/`dapatkanNilaiKolom` memakai `replace(/[\s_]|_x0020_/g, '')`. Karena `[\s_]` dicoba lebih dulu, varian `Nama_x0020_Kegiatan` **tidak pernah cocok** lewat jalur normalisasi (kode produksi tertolong karena beberapa pemanggilan menuliskan varian itu secara eksplisit). Di fitur ini sudah dibalik urutannya. Layak diperbaiki saat integrasi.
- `kronologis.html` mencocokkan kegiatan hanya dari nama (tanpa provinsi), sehingga nama seperti "01. Notulensi" tercampur antarprovinsi.

## Belum teruji (butuh Anda)
1. **Flow asli**: batas ukuran kiriman di tenant Anda, pembuatan folder `H`, penulisan Excel. Uji dengan `tests/make_payload.js --kecil` dulu.
2. **Data live nyata**: bentuk kolom sebenarnya di `GetMasterData` (fixture meniru variasi yang terlihat di kode Anda).
3. PowerPoint desktop dan clipboard nyata (catatan Fase 0–1 masih berlaku).
