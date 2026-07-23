# Panduan Live Data — Terminal Profile SPTP

## Struktur baru
```
Terminal Profile SPTP/
├── Master_Data_Terminal_LIVE.xlsx     ← sumber data, kamu yang update
├── js/sheet-data.js                   ← modul fetch + render (jangan diedit kecuali nambah field baru)
├── public/terminal-merauke.html       ← versi publik (pilot)
└── internal/terminal-merauke.html     ← versi internal (pilot)
```

Kedua versi (public & internal) saat ini identik dan mengambil data dari sumber Sheets yang sama, karena sudah dikonfirmasi seluruh field — termasuk data keuangan — boleh tampil publik. Folder tetap dipisah untuk memudahkan jika suatu saat kebijakan berubah dan versi internal perlu field tambahan yang tidak ada di publik.

## Langkah setup (sekali di awal)

1. Buka Google Drive, upload `Master_Data_Terminal_LIVE.xlsx`. Google otomatis menawarkan buka dengan Google Sheets — buka, lalu **File > Save as Google Sheets** agar jadi file Sheets asli (bukan cuma preview xlsx).
2. Untuk masing-masing tab (TERMINAL_MASTER, INFRASTRUKTUR, PERALATAN, TRAFFIC, PERFORMANCE, TARIFF, SDM, KONTAK): **File > Share > Publish to web**, pilih tab tersebut di dropdown, format **Comma-separated values (.csv)**, klik Publish, salin link yang muncul.
3. Buka `js/sheet-data.js`, di bagian atas ada `SHEET_URLS`. Tempel link CSV masing-masing tab menggantikan `"PASTE_CSV_URL_..."`.
4. Simpan. Selesai — kedua file HTML (public & internal) otomatis pakai data live begitu dibuka di browser (butuh internet).

## Cara update data sehari-hari
Cukup edit angka di Google Sheets (bukan file Excel lokal). Refresh halaman HTML di browser — angka baru langsung tampil. Tidak perlu generate ulang atau re-upload apa pun.

## Cara menambah terminal baru
1. Tambah baris baru di setiap tab Sheets dengan kode_terminal baru (mis. `TPK-MKS` untuk Makassar), isi datanya.
2. Duplikat folder `public/terminal-merauke.html` → `public/terminal-<nama>.html` (begitu juga di `internal/`).
3. Di file baru itu, ganti isi konten section per section sesuai terminal tersebut (foto, teks naratif, ikon peralatan bila jenis alatnya beda), lalu ganti baris pemanggilan:
   ```js
   initTerminalData("TPK-MRK")
   ```
   menjadi kode terminal yang baru, misalnya `initTerminalData("TPK-MKS")`.

## Yang sudah live (otomatis update dari Sheets)
Hero (volume TEUs & kapasitas terminal), kapasitas dermaga/yard/crane, spesifikasi infrastruktur (panjang dermaga, draft, luas CY), grafik traffic tahunan, tabel KPI performance lengkap, breakdown SDM per fungsi, jumlah unit peralatan (6 jenis yang sudah ada), ringkasan total tarif 4 ukuran kontainer, alamat & email kontak.

## Yang masih perlu diedit manual per terminal
Foto, teks naratif (about, hinterland, strategic development), ikon SVG peralatan (kalau jenis alatnya beda dari 6 yang sudah ada), rincian tabel tarif per komponen (A/B/C), nama/nomor telepon leadership, dan 4 kartu KPI besar di bagian atas performance (Container Volume/Revenue/Operating Profit/EBITDA) — datanya tetap tersimpan lengkap di tab PERFORMANCE untuk referensi, hanya belum di-render otomatis ke kartu tersebut (tabel detail di bawahnya sudah otomatis).

## Catatan keamanan
Karena data diambil lewat "publish to web", siapa pun yang tahu link CSV bisa membacanya langsung (bukan cuma lewat halaman HTML). Ini bukan celah baru — sudah konsisten dengan keputusan bahwa seluruh data termasuk keuangan boleh publik. Kalau ke depan ada field yang ingin dirahasiakan, perlu tab/Sheet terpisah dan pendekatan ini perlu direvisi.

## 31 terminal lainnya
Baris untuk 31 terminal selain Merauke di `Master_Data_Terminal_LIVE.xlsx` masih placeholder `[TBD]` — saya tidak mengisi nama/kode asli karena saya tidak punya daftar resmi 32 terminal Pelindo Terminal Petikemas yang terverifikasi. Mohon isi kode dan nama sebenarnya di tab TERMINAL_MASTER sebelum mengisi tab lainnya.
