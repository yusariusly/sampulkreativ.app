# Sistem Absensi PWA (Split Architecture)

Proyek ini telah dipisahkan menjadi struktur folder **Frontend** (Next.js) dan **Backend** (Express.js) untuk mempermudah pemeliharaan dan deploy produksi.

## Struktur Direktori

```
application_absensi_v2/
├── frontend/    # Aplikasi UI Mobile-Optimized & Admin Panel (Next.js)
└── backend/     # Layanan REST API & Pengolah Media/Selfie (Express.js)
```

## Cara Menjalankan Aplikasi

Pastikan database MySQL Anda sudah menyala terlebih dahulu di WSL.

### 1. Jalankan Express Backend (Port 5000)
Buka terminal baru, masuk ke folder `backend`, lalu jalankan:
```bash
cd backend
npm run dev
```
Server backend akan berjalan di `http://localhost:5000` dan secara otomatis menginisialisasi skema basis data serta tabel MySQL (`absensi_db`) beserta seed datanya jika kosong.

### 2. Jalankan Next.js Frontend (Port 3000)
Buka terminal baru lainnya, masuk ke folder `frontend`, lalu jalankan:
```bash
cd frontend
npm run dev -- -H 0.0.0.0
```
Server frontend akan berjalan di `http://localhost:3000`. Next.js dikonfigurasi dengan rewrites otomatis untuk meneruskan request `/api/*` dan `/uploads/*` ke Express backend di port 5000 secara transparan.

---

## Variabel Lingkungan (Environment Variables)

Secara bawaan, backend akan mencoba terhubung ke database lokal menggunakan konfigurasi:
* **Host**: `127.0.0.1`
* **User**: `root`
* **Password**: `root`
* **Database**: `absensi_db`

Jika Anda ingin mengubah konfigurasi database, buat file `.env` di dalam folder `backend/` dengan isi:
```env
PORT=5000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=password_mysql_anda
DB_NAME=absensi_db
```
