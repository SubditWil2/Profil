"""Membuat sample_data/pohuwato.json + foto uji dari deck contoh. Argumen: <folder media hasil unzip> <folder keluaran sample_data>."""
import json, os, sys
from PIL import Image
SRC = sys.argv[1].rstrip('/') + '/'; OUT = sys.argv[2].rstrip('/') + '/'; DST = OUT + 'photos/'
os.makedirs(DST, exist_ok=True)
def conv(n, out, maxs=1600, q=82):
    for ext in ('png', 'jpeg'):
        p = f'{SRC}image{n}.{ext}'
        if os.path.exists(p): break
    im = Image.open(p).convert('RGB')
    if max(im.size) > maxs: im.thumbnail((maxs, maxs), Image.LANCZOS)
    im.save(DST + out, 'JPEG', quality=q, optimize=True)
for k, n in {'design3d': 20, 'pra': 18, 'pasca': 19, 'kurvas': 27}.items(): conv(n, f'{k}.jpg')
for n in [28, 29, 30, 31, 32, 33, 34, 35, 21, 22, 23, 24, 25, 26]: conv(n, f'foto_{n}.jpg')

K = [("2024.04.19","Usulan Anggaran","900/Peru/388","Bupati Pohuwato","Menteri Pekerjaan Umum dan Perumahan Rakyat RI"),
("2024.04.24","Disposisi Bapak Menteri PUPR Kunker Pres ke Gorontalo & Sulbar","","Menteri PUPR",""),
("2024.05.08","Permohonan Anggaran","800/PEM-DPU-PR/468","Bupati Pohuwato","Bapak Presiden RI Ir. Joko Widodo"),
("2024.05.20","Permohonan Audiensi","800/12/DPU.PR/PHWT/V/2024","Bupati Pohuwato","Menteri Pekerjaan Umum dan Perumahan Rakyat RI"),
("2024.05.22","Disposisi Bapak Menteri PUPR Surat Permohonan audiensi","494/AM/24","Menteri PUPR","Menteri PUPR"),
("2024.05.27","Laporan Survey Kegiatan Bina Penataan Bangunan di Provinsi Gorontalo","818/ND/Cb/2024","Direktur Bina Penataan Bangunan","Direktur Jenderal Cipta Karya"),
("2025.07.18","Usulan Kegiatan Pembangunan Kantor Bupati Pohuwato Provinsi Gorontalo","908/ND/Cb/2025","Direktur Bina Penataan Bangunan","Direktur Jenderal Cipta Karya"),
("2025.09.10","Kebijakan Pembangunan Bangunan Gedung Negara","B-14/M/SDK/SA.00/09/2025","Menteri Sekretaris Negara","Menteri Pekerjaan Umum"),
("2026.05.26","Surat Perjanjian Supervisi Pembangunan Gedung Kantor Bupati Pohuwato","HK0201/Bpbpk31.4.1/2026/02","PPK Perencanaan BPBPK Gorontalo","Direktur PT. Manggalakarya KSO CV. Mulya Persada"),
("2026.07.10","Penyampaian informasi atas Pengaduan Masyarakat oleh Dewan Perwakilan Daerah Republik Indonesia Provinsi Gorontalo","PW0202/R/Ci/2026/161","Direktur Kepatuhan Intern","Plt. Direktur Jenderal Cipta Karya"),
("2025.09.16","Usulan Pembangunan Kantor Bupati Pohuwato","600/PUPR-PKP/1084/IX/2025","Gubernur Gorontalo","Menteri Pekerjaan Umum"),
("2025.09.17","Penyampaian Informasi Kegiatan Pembangunan Kantor Bupati Pohuwato","UM 01.03/Bpbpk31/404","Kepala Balai Penataan Bangunan, Prasarana Kawasan Gorontalo","Bupati Pohuwato"),
("2025.09.19","Laporan Usulan Kegiatan Pembangunan Kantor Bupati Pohuwato Provinsi Gorontalo","1137/ND/Cb/2025","Direktur Bina Penataan Bangunan","Direktur Jenderal Cipta Karya"),
("2025.09.22","Pembangunan Gedung Kantor Bupati Pohuwato Provinsi Gorontalo","CK0402-DC/768","Direktorat Jenderal Cipta Karya, Kementerian Pekerjaan Umum","Deputi Bidang Politik, Hukum, Keamanan, dan Hak Asasi Manusia, Kementerian Sekretariat Negara"),
("2026.05.29","Surat Perjanjian Pembangunan Gedung Kantor Bupati Pohuwato","HK0201 / Bpbpk31.5.2/2026/01","PPK PKS dan BPB Satker PCK Gorontalo","Kepala Cabang PT. Cipta Adhi Guna"),
("2026.07.10","Tanggapan atas Pengaduan Masyarakat oleh Dewan Perwakilan Daerah Republik Indonesia Provinsi Gorontalo","PW0202/T/Ci/2026/162","Direktur Kepatuhan Intern","Kepala Balai Penataan Bangunan, Prasarana dan Kawasan Gorontalo")]
PROV, KEG = '05. Gorontalo', '02. Pembangunan Kantor Bupati Pohuwato'
raw = [{"Provinsi": PROV, "Nama Kegiatan": KEG, "Jenis Dokumen": "Surat", "Tanggal": a, "Perihal": b, "Nomor Surat": c, "AlurDari": d, "AlurKe": e, "IsKronologis": "Ya"} for a, b, c, d, e in K]
raw.append({"Provinsi": "08. Nusa Tenggara Barat", "Nama Kegiatan": KEG, "Jenis Dokumen": "Surat", "Tanggal": "2026.01.01", "Perihal": "[PENGECOH] provinsi lain, nama kegiatan sama", "Nomor Surat": "X/1", "AlurDari": "-", "AlurKe": "-", "IsKronologis": "Ya"})
raw.append({"Provinsi": PROV, "Nama Kegiatan": KEG, "Jenis Dokumen": "Nota Dinas", "Tanggal": "2026.02.02", "Perihal": "[PENGECOH] tidak ditandai kronologis", "Nomor Surat": "X/2", "AlurDari": "-", "AlurKe": "-", "IsKronologis": "Tidak"})
f = lambda n, kel, ket, sor=False: {"file": f"photos/foto_{n}.jpg", "kelompok": kel, "keterangan": ket, "sorotan": sor}
data = {
 "_catatan": "Data uji Fase 0/1 dari deck Profil_Pembangunan_Kantor_Bupati_Pohuwato.pptx. Keterangan foto hanya untuk menguji tata letak (foto uji belum tentu sesuai keterangannya). Baris bertanda [PENGECOH] harus tersaring.",
 "kegiatan": {"provinsi": PROV, "namaKegiatan": KEG},
 "profilDasar": {
  "judul": "Pembangunan Kantor Bupati Pohuwato", "kodeKontrak": "SYC", "tahun": 2026,
  "lokasiSingkat": "Kab. Pohuwato, Provinsi Gorontalo", "lokasiPekerjaan": "Kabupaten Pohuwato, Provinsi Gorontalo",
  "tglMulai": "2026.05.29", "tglSelesai": "2026.12.31", "luasPersil": 30000, "luasBangunan": 3444,
  "pihak": [{"peran": "Konsultan Supervisi", "nama": "PT. Manggala Karya Bangun Sarana", "nilai": 1079968728},
            {"peran": "Kontraktor Pelaksana", "nama": "PT. Cipta Adhi Guna", "nilai": 37268364000}],
  "lingkup": ["Kantor Bupati Pohuwato (Luas: 3.147 m2 2 Lantai)", "Powerhouse (Luas: 297 m2 1 Lantai)"],
  "latarBelakang": ["Gedung Kantor Bupati Pohuwato merupakan Pusat Pemerintahan dan Fasilitas Pelayanan Publik yang sangat dibutuhkan oleh masyarakat Kabupaten Pohuwato, Provinsi Gorontalo, dan merupakan salah satu bangunan gedung negara yang mengalami kerusakan total akibat insiden kerusuhan dan pembakaran pada bulan September tahun 2023 silam.",
   "Sebagai pusat penyelenggaraan pemerintahan daerah yang vital bagi keberlangsungan pelayanan publik di Kabupaten Pohuwato, Pembangunan kembali gedung kantor bupati merupakan sebuah urgensi guna memulihkan fungsi penyelenggaraan pemerintahan, meningkatkan kualitas pelayanan publik, serta mengoptimalkan kembali tata kelola administrasi daerah secara efektif dan kondusif. Untuk itu Pemerintah Kabupaten Pohuwato telah melakukan penyusunan Dokumen Perencanaan Pembangunan Kantor Bupati Pohuwato pada Tahun 2024."],
  "maksudTujuan": ["Maksud Pelaksanaan Pembangunan Kantor Bupati Pohuwato adalah melaksanakan Pembangunan Kembali Gedung Kantor Bupati Pohuwato yang Terdampak Bencana Non-Alam (Kerusuhan) sehingga gedung tersebut dapat difungsikan kembali sebagai pusat fasilitas pelayanan pemerintahan dan administrasi publik bagi masyarakat."],
  "aset": {"design3d": "photos/design3d.jpg", "pra": "photos/pra.jpg", "pasca": "photos/pasca.jpg"},
  "capPra": "Kondisi Bangunan Pra-Kerusuhan", "capPasca": "Kondisi Bangunan Pasca-Kerusuhan"},
 "progres": {"tanggalStatus": "2026.08.16",
  "fisik": {"rencana": 11.63, "realisasi": 7.68}, "keuangan": {"rencana": 20.0, "realisasi": 20.0},
  "masalah": ["Pengadaan material bekisting terambat sehingga menghambat pelaksanaan pengecoran;",
   "Pekerjaan pemancangan yang telah dilaksanakan menunjukkan penetrasi rata-rata mencapai kedalaman +- 7 m dari permukaan tanah. Hal ini menjadi kendala karena panjang minipile yang disiapkan adalah 6 m sehingga mayoritas tiang pancnag tidak mencapai final set dan tidak dapat dilakukan kalendering."],
  "tindakLanjut": ["Penyedia Jasa perlu mempercepat pengadaan material agar tidak ada area kerja yang idle.",
   "Konsultan Perencana akan menyampaikan Rekomendasi teknis untuk dapat diimplementasikan di lapangan. Akan dilakukan pembahasan dengan Narasumber Ahli Geoteknik.",
   "PJ dan Konsultan Supervisi perlu segera menyusun schedule percepatan."],
  "kurvaS": "photos/kurvas.jpg"},
 "foto": [f(21,"Gedung A1","Tampak Depan",True), f(22,"Gedung A1","Tampak Belakang",True), f(23,"Gedung A2","Tampak Depan",True), f(24,"Gedung A2","Tampak Belakang",True), f(26,"Gedung A3","Tampak Depan",True), f(25,"Gedung A3","Tampak Belakang",True)]
       + [f(n, k, s) for n, k, s in [(28,"Bangunan A1","Tampak Depan"),(29,"Bangunan A1","Tampak Belakang"),(30,"Bangunan A2","Tampak Depan"),(31,"Bangunan A2","Tampak Samping"),(32,"Bangunan A2","Tampak Belakang"),(33,"Bangunan A3","Tampak Depan"),(34,"Bangunan A3","Tampak Samping"),(35,"Bangunan A3","Tampak Belakang"),(21,"Powerhouse","Tampak Depan"),(22,"Powerhouse","Tampak Samping"),(23,"Powerhouse","Tampak Belakang"),(24,"Powerhouse","Tampak Atas"),(25,"Powerhouse","Tampak Dalam")]],
 "kronologisRaw": raw}
json.dump(data, open(OUT + 'pohuwato.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
print(len(raw), 'baris kronologis;', len(data['foto']), 'foto')
