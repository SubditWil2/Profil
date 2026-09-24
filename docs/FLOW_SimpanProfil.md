# Flow baru: `SimpanProfil` (Power Automate) + tabel Excel `ProfilProgres`

Flow ini **baru**. Tidak mengubah flow yang sudah ada (`GetMasterData` tetap hanya dibaca oleh `profil.html`).
Pola sama dengan flow Notulensi/ND: PPTX dibuat di browser, flow hanya **menyimpan file dan mencatat satu baris Excel**.

## 1. Tabel Excel `ProfilProgres`
Buat tabel baru (nama tabel: `ProfilProgres`) di workbook DMS. Satu baris per laporan.

| Kolom | Isi | Catatan |
|---|---|---|
| Provinsi | teks | kunci bersama Nama Kegiatan + Tanggal Status |
| Nama Kegiatan | teks | |
| Tanggal Status | teks `YYYY.MM.DD` | format sama dengan tabel lain |
| Judul | teks | |
| Fisik Rencana, Fisik Realisasi, Keu Rencana, Keu Realisasi | angka | boleh kosong |
| Masalah, Tindak Lanjut | teks, satu poin per baris | batas 32.767 karakter per sel |
| Jumlah Foto, Jumlah Slide | angka | |
| **PathPPTX** | teks | `targetFolderPath/fileName` — **kunci baris** (satu file = satu baris). Nama kolom tanpa spasi; halaman membaca kolom ini walau ditulis `Path PPTX` |
| Link PPTX | teks | tautan yang dikembalikan flow |
| Snapshot | teks JSON | boleh panjang; dipakai fase berikutnya untuk "salin dari laporan sebelumnya" |
| PIC | teks | |
| Timestamp | teks ISO | |

> **Kunci baris = path PPTX** (tanpa kolom kunci terpisah). Konektor Excel hanya mendukung **satu** kondisi di Filter Query (`eq`, `ne`, `contains`, `startswith`, `endswith`; `and`/`or` ditolak dengan `Invalid filter clause: unsupported operation`), dan path sudah unik per kegiatan + tanggal + judul, jadi cukup `PathPPTX eq '…'`. Halaman mengirim path itu siap pakai sebagai `pathPptx`.
>
> Konsekuensi: laporan dengan tanggal **dan** judul yang sama menimpa file dan barisnya; jika tanggal atau judul berubah, nama file berubah sehingga tercatat sebagai laporan baru.

## 2. Trigger: When an HTTP request is received
**Wajib: atur "Who can trigger the flow?" = `Anyone`.** Flow baru bawaannya `Any user in my tenant`: URL-nya **tanpa `sig=`** dan menolak panggilan dari browser dengan `401 — The OAuth authorization scheme is required`. Dengan `Anyone`, URL memuat `&sp=…&sv=1.0&sig=…` (sama seperti flow Notulensi/ND yang sudah ada). Setelah mengubahnya, **simpan flow lalu salin ulang URL**; URL lama tidak berlaku. (Jika opsi `Anyone` abu-abu, kebijakan tenant melarangnya; minta admin atau pakai jalur autentikasi lain.)

Method POST. **Request Body JSON Schema** — tempel isi `docs/schema_SimpanProfil.json` (skema **lengkap**, sudah memuat bagian Fase 3: `pathPptx`, `simpanMaster`, `master`, `aset`).

> Semua kunci di bawah `properties` harus **di dalam** `properties`. Kunci yang ditaruh sejajar dengan `properties` (di tingkat atas) diabaikan Power Automate, sehingga `master`, `aset`, dan `simpanMaster` tidak muncul sebagai *dynamic content*.

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string"
    },
    "provinsi": {
      "type": "string"
    },
    "namaKegiatan": {
      "type": "string"
    },
    "namaKegiatanFolder": {
      "type": "string"
    },
    "targetFolderPath": {
      "type": "string"
    },
    "fileName": {
      "type": "string"
    },
    "pathPptx": {
      "type": "string"
    },
    "pptxBase64": {
      "type": "string"
    },
    "tanggalStatus": {
      "type": "string"
    },
    "judul": {
      "type": "string"
    },
    "fisikRencana": {},
    "fisikRealisasi": {},
    "keuRencana": {},
    "keuRealisasi": {},
    "masalah": {
      "type": "string"
    },
    "tindakLanjut": {
      "type": "string"
    },
    "jumlahFoto": {
      "type": "integer"
    },
    "jumlahSlide": {
      "type": "integer"
    },
    "snapshotJson": {
      "type": "string"
    },
    "pic": {
      "type": "string"
    },
    "timestamp": {
      "type": "string"
    },
    "payloadMB": {
      "type": "number"
    },
    "simpanMaster": {
      "type": "boolean"
    },
    "master": {
      "type": "object",
      "properties": {
        "judul": {},
        "kodeKontrak": {},
        "tahun": {},
        "lokasiSingkat": {},
        "lokasiPekerjaan": {},
        "tglMulai": {},
        "tglSelesai": {},
        "luasPersil": {},
        "luasBangunan": {},
        "pihakJson": {},
        "lingkup": {},
        "latarBelakang": {},
        "maksudTujuan": {},
        "capPra": {},
        "capPasca": {}
      }
    },
    "aset": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "nama": {
            "type": "string"
          },
          "ext": {
            "type": "string"
          },
          "base64": {
            "type": "string"
          }
        }
      }
    }
  },
  "required": [
    "provinsi",
    "namaKegiatan",
    "targetFolderPath",
    "fileName",
    "pptxBase64",
    "tanggalStatus",
    "pic"
  ]
}
```
Angka progres dikirim sebagai angka, atau string kosong `""` bila belum diisi (karena itu skemanya dibiarkan tanpa `type`).

## 3. Langkah flow (urutan)

1. **Validasi jalur (Condition)**. Path berasal dari browser, jadi flow harus memeriksa sendiri. Semua harus benar, jika tidak → Response 400 dan berhenti:
   - `startsWith(triggerBody()?['targetFolderPath'], '/SUBDIT WILAYAH 2 BPB/')`
   - `endsWith(triggerBody()?['targetFolderPath'], '/H. Profil')`
   - `not(contains(triggerBody()?['targetFolderPath'], '..'))`
   - `endsWith(triggerBody()?['fileName'], '.pptx')`
   - `not(or(contains(triggerBody()?['fileName'], '/'), contains(triggerBody()?['fileName'], '\\')))`
2. **Pengaman fisik (Get file metadata using path)** untuk folder kegiatan induk (`/SUBDIT WILAYAH 2 BPB/{provinsi}/{namaKegiatanFolder}`), sesuai prinsip di `dms-shared.js`. Jika tidak ada → Response 404 "Folder kegiatan tidak ditemukan".
3. **Folder `H. Profil`**: periksa dengan *Get file metadata using path*; jika belum ada, buat dengan aksi pembuatan folder yang sama dengan yang dipakai flow Notulensi/Folderisasi. Saran: tambahkan `H. Profil` ke templat folderisasi supaya kegiatan baru langsung punya folder ini.
4. **Simpan file**: *Get file metadata using path* untuk `targetFolderPath/fileName`.
   - Belum ada → **Create file** (isi: `base64ToBinary(triggerBody()?['pptxBase64'])`).
   - Sudah ada (laporan dengan tanggal yang sama) → **Update file** (menimpa).
5. **Tautan**: buat/ambil tautan dengan aksi yang sama seperti flow Notulensi (nilai yang dikembalikan sebagai `linkBerkas`).
6. **Excel** — kunci = path PPTX. Mulai dengan aksi **Compose** `PathPPTX`:
   `coalesce(triggerBody()?['pathPptx'], concat(triggerBody()?['targetFolderPath'], '/', triggerBody()?['fileName']))`
   (dengan `coalesce`, flow tetap benar walau halaman versi lama belum mengirim `pathPptx`). Pakai `outputs('PathPPTX')` di semua tempat di bawah, **jangan** `triggerBody()?['pathPptx']` langsung.
   1. *List rows present in a table* (`ProfilProgres`), **Filter Query**: `PathPPTX eq '@{outputs('PathPPTX')}'`.
      Bila path bisa memuat tanda petik satu, pakai `PathPPTX eq '@{replace(outputs('PathPPTX'), '''', '''''')}'`.
   2. **Condition** `length(body('List_rows_present_in_a_table')?['value'])` lebih besar dari 0:
      - **Ya** → *Update a row*: **Key Column** `PathPPTX`, **Key Value** `@{outputs('PathPPTX')}`.
      - **Tidak** → *Add a row into a table*.
      Kedua cabang mengisi semua kolom bagian 1, termasuk `PathPPTX` = `@{outputs('PathPPTX')}`.
   4. Baris yang **kolom PathPPTX-nya kosong** (sisa uji) akan cocok dengan filter path kosong dan memicu *Update a row* gagal; hapus baris seperti itu dari tabel.
7. **Response 200**:
   ```json
   { "linkBerkas": "<tautan>", "filePath": "<targetFolderPath>/<fileName>" }
   ```
   Halaman menerima balasan polos maupun yang terbungkus `body`.
8. **Penanganan galat**: bungkus langkah 2–6 dalam Scope; cabang *Configure run after: has failed* → Response 500 dengan `{ "error": { "message": "<pesan spesifik>" } }`. Halaman menampilkan pesan itu apa adanya.

## 4. Ukuran
`payloadMB` menunjukkan ukuran kiriman (base64). Batas praktis trigger HTTP dan aksi Create file **belum diuji** di tenant Anda. Uji dengan payload `--kecil` (≈3 MB) lalu payload penuh (≈10 MB), dan isi `maxPayloadMB` di `profil-config.js` sesuai hasilnya (bawaan 50).

## 5. Menguji flow tanpa halaman
```
node tests/make_payload.js contoh_payload.json --kecil     # ±3 MB, tanpa foto
node tests/make_payload.js contoh_payload_penuh.json       # ±10 MB, dengan foto
```
Isi `contoh_payload.json` ke tab **Test** flow (atau `curl -X POST -H "Content-Type: application/json" --data @contoh_payload.json "<URL flow>"`). Nama file otomatis berawalan `UJI` agar tidak menimpa laporan asli; hapus setelah uji.

## 6. Setelah flow jadi
1. Salin URL trigger ke `saveFlowUrl` di `profil-config.js`. URL memuat tanda tangan akses: jangan dibagikan dan jangan di-commit ke repositori publik.
2. Buka `profil.html` → *Muat dari DMS* → pilih kegiatan → isi → *Simpan ke OneDrive*.
3. Cek: file ada di `H. Profil`, baris `ProfilProgres` bertambah, tautan terbuka.

## 7. Fase 3 — profil dasar per kegiatan, gambar statis, dan flow `BacaProfil`

### 7.1 Tabel Excel `ProfilKegiatan` (satu baris per kegiatan; kunci = Provinsi + Nama Kegiatan)
**PathFolder** (= `targetFolderPath`, kunci baris; nama kolom tanpa spasi) · Provinsi · Nama Kegiatan · Judul Profil · Kode Kontrak · Tahun · Lokasi Singkat · Lokasi Pekerjaan · Tgl Mulai · Tgl Selesai (`YYYY.MM.DD`) · Luas Persil · Luas Bangunan · Pihak (JSON) · Lingkup (satu poin per baris) · Latar Belakang (paragraf dipisah baris kosong) · Maksud Tujuan (idem) · Cap Pra · Cap Pasca · Diubah Oleh · Diubah Pada.

### 7.2 Tambahan pada trigger `SimpanProfil`
Skema di bagian 2 sudah memuat `simpanMaster`, `master`, dan `aset` (semuanya opsional; halaman hanya mengirimnya bila kotak *Simpan profil dasar…* dicentang).

Langkah tambahan (setelah file PPTX tersimpan), **hanya bila `simpanMaster` = true**:
1. **Upsert `ProfilKegiatan`**: *List rows* dengan Filter Query `PathFolder eq '@{triggerBody()?['targetFolderPath']}'` → jika ada, *Update a row* (Key Column `PathFolder`, Key Value `@{triggerBody()?['targetFolderPath']}`), jika tidak, *Add a row* (isi juga kolom `PathFolder`). `Diubah Oleh` = `pic`, `Diubah Pada` = `timestamp`.
2. **Simpan gambar statis** — **letakkan di dalam cabang *Yes* dari Condition `simpanMaster`** (bila tidak, `aset` bernilai null dan *For each* gagal: `The result of the evaluation of 'foreach' expression … is of type 'Null'`). Jika tetap di luar Condition, pakai **`@coalesce(triggerBody()?['aset'], json('[]'))`** sebagai isi *For each*.
   Di dalam *For each*:
   1. **Condition** `contains(createArray('design3d','pra','pasca'), item()?['nama'])` — selain itu diabaikan.
   2. **Create file** (OneDrive): Folder `@{triggerBody()?['targetFolderPath']}/_aset`, Name `@{item()?['nama']}.@{item()?['ext']}`, File Content **`@base64ToBinary(item()?['base64'])`** (bukan `triggerBody()?['base64']` — isi larik dibaca lewat `item()`).
   3. *Create file* tidak menimpa berkas yang sudah ada. Untuk pembaruan gambar: tambahkan **Get file metadata using path** (path yang sama) dengan *Configure run after* = **Create file has failed**, lalu **Update file** (File = `Id` dari metadata, konten sama seperti di atas).

### 7.3 Flow baru `BacaProfil` (trigger HTTP, **Anyone**, method POST)
Skema trigger:
```json
{ "type": "object", "properties": { "action": { "type": "string" }, "provinsi": { "type": "string" }, "namaKegiatan": { "type": "string" }, "folderPath": { "type": "string" } }, "required": ["provinsi", "namaKegiatan", "folderPath"] }
```
> **Aksi Response wajib memiliki *Body*.** Response yang hanya berisi `Status Code 200` mengirim balasan kosong, dan halaman menafsirkannya sebagai "belum ada profil dasar".

Urutan langkah:
1. **Initialize variable** `aset` (Array, nilai `[]`) — harus di tingkat atas, sebelum Condition.
2. **List rows present in a table** (`ProfilKegiatan`): Filter Query `PathFolder eq '@{triggerBody()?['folderPath']}'`.
3. **Condition** `length(body('List_rows_present_in_a_table')?['value'])` lebih besar dari 0.
   - **No** → **Response** 200, Body `{ "found": false }`.
   - **Yes** →
     1. **List rows present in a table** (`ProfilProgres`): Filter Query `PathPPTX startswith '@{triggerBody()?['folderPath']}/'`, Order By `PathPPTX desc`, Top Count `3`.
     2. **For each** pada `@createArray('design3d','pra','pasca')` (concurrency 1): **Get file content using path** `@{triggerBody()?['folderPath']}/_aset/@{items('For_each')}.jpg`, lalu **Append to array variable** `aset` (hanya bila langkah sebelumnya sukses) dengan nilai:
        ```json
        { "nama": "@{items('For_each')}", "ext": "jpg", "base64": "@{body('Get_file_content_using_path')?['$content']}" }
        ```
        Gambar yang belum ada membuat iterasinya gagal; itu wajar.
     3. **Response** 200 — *Configure run after*: centang **is successful** dan **has failed** pada *For each* (agar tetap jalan saat ada gambar yang belum ada). Body:
        ```
        {
          "found": true,
          "master": @{first(body('List_rows_present_in_a_table')?['value'])},
          "aset": @{variables('aset')},
          "laporan": @{body('List_rows_present_in_a_table_1')?['value']}
        }
        ```
        Sisipkan tiap `@{…}` lewat editor ekspresi (tanpa tanda kutip di sekitarnya). Halaman juga menerima bila salah satunya terlanjur berupa string JSON.

### 7.4 Setelah dibuat
Isi `readFlowUrl` di `profil-config.js`. Alur di halaman: pilih kegiatan → profil dasar + 3 gambar statis terisi otomatis → tombol *Salin angka & catatan dari laporan …* → isi data periodik, tempel foto lapangan dan kurva S → simpan. Centang *Simpan profil dasar…* hanya bila profil dasar atau gambar statisnya berubah.

## 8. Pemecahan masalah
| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `Invalid filter clause: unsupported operation. Only single 'eq', 'ne', 'contains', 'startswith' or 'endswith'…` | Filter Query Excel memakai `and`/`or` | Pakai satu kondisi saja: `PathPPTX eq '…'` (bagian 3 langkah 6) |
| Form menampilkan "Belum ada profil dasar" padahal baris sudah ada | Response `BacaProfil` tanpa Body (balasan kosong), `PathFolder` di Excel berbeda dengan `folderPath` yang dikirim, atau Condition mengembalikan `found:false` | Isi Body Response (bagian 7.3); cek riwayat run → output Response; samakan `PathFolder` persis `…/H. Profil` |
| `The result of the evaluation of 'foreach' expression … is of type 'Null'` | `aset` tidak dikirim (simpanMaster = false) | Taruh *For each* di dalam cabang Yes `simpanMaster`, atau `coalesce(triggerBody()?['aset'], json('[]'))` |
| `Update_a_row failed … parameters … 'id' … may not be null or empty` | Key Value (path) kosong: halaman lama belum mengirim `pathPptx`, dan baris uji dengan `PathPPTX` kosong sudah ada sehingga filter menemukannya | Pakai Compose `PathPPTX` dengan `coalesce` (bagian 3 langkah 6), perbarui `profil-save.js`, hapus baris dengan PathPPTX kosong di tabel |
| `401 … The OAuth authorization scheme is required` | Trigger `Any user in my tenant`; URL tanpa `sig=` | Ubah ke `Anyone`, simpan, salin ulang URL lengkap |
| Halaman menampilkan peringatan "URL flow tidak memuat sig=" | Sama seperti di atas | Sama |
| `400`/`Kolom wajib kosong` | Skema trigger `required` tidak terpenuhi | Periksa nama pembuat dan tanggal status sudah terisi |
| `Flow tidak mengembalikan linkBerkas` | Response 200 tidak berisi `linkBerkas` | Periksa isi aksi Response (bagian 3 langkah 7) |
| Timeout | File besar atau flow lambat | Naikkan `timeoutMs`, kurangi foto |
