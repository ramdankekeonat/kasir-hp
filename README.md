# Kasir HP — HTML + CSS + JavaScript + MongoDB

Versi awal aplikasi kasir yang dibuat mobile-first.

## Fitur

- Kategori ALL, TEA, MILKTEA, MILKY, KOPI, POPICE
- Tambah/kurang jumlah produk
- Total otomatis
- Input uang pelanggan
- Kembalian otomatis
- Status PAS jika uang sama dengan total
- Checkout menyimpan transaksi ke MongoDB
- Data pemasukan harian
- Data bulanan
- Tambah pengeluaran
- Penghasilan bersih = pemasukan - pengeluaran
- Ringkasan bulanan real time: bulan sekarang + bulan depan (otomatis ikut tanggal hari ini)
- Data transaksi tidak dihapus otomatis

## 1. Install Node.js

Install Node.js LTS terlebih dahulu.

## 2. Install MongoDB lokal

Install MongoDB Community Server dan pastikan servicenya berjalan.

Database default yang dipakai:

mongodb://127.0.0.1:27017/kasir_hp

## 3. Install dependency

Di folder project:

npm install

## 4. Jalankan produk contoh

npm run seed

## 5. Jalankan aplikasi

npm start

Buka:

http://localhost:5000

Untuk development:

npm run dev

## Struktur

- server.js = Express + API + koneksi MongoDB
- seed.js = data produk contoh
- public/index.html = halaman kasir/data
- public/style.css = tampilan mobile
- public/app.js = JavaScript frontend

## Catatan untuk Android

Setelah versi web stabil, frontend ini dapat dibungkus menjadi APK menggunakan Capacitor.

Untuk MongoDB Atlas nanti, cukup ganti MONGO_URI di file .env dengan connection string Atlas. Frontend tidak menyimpan username/password MongoDB; APK hanya mengakses API Express.
