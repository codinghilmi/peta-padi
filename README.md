# Dashboard Interaktif Komparasi Produktivitas Padi Antarwilayah Kepulauan Indonesia (2024)

Web dashboard interaktif berbasis peta SVG (*map-first dashboard*) untuk proyek akhir mata kuliah **Statistika Dasar**:

> **Analisis Komparasi Produktivitas Padi Antarwilayah Kepulauan di Indonesia (2024)**

## Fitur Utama
- **Kanvas Peta SVG Indonesia Terpadu:** Menggabungkan 34 geometri provinsi (`./maps/indonesia.html`) ke dalam 6 kelompok kawasan kepulauan dengan proporsi layar penuh (`preserveAspectRatio="xMidYMid meet"`).
- **Dua Mode Eksplorasi:**
  - **Mode Kawasan (Uji Beda):** Hover menyorot satu kawasan kepulauan secara serempak, klik mengunci kawasan dan otomatis menandai kawasan lawan yang berbeda signifikan menurut **Tukey HSD** menggunakan aksen oranye-bata (`#C85A32`).
  - **Mode Provinsi (38 Prov):** Menampilkan gradasi produktivitas per provinsi serta rincian luas panen, produksi, dan selisih terhadap rata-rata 38 provinsi (`45,22 ku/ha`).
- **Panel Detail Statistik:** Ringkasan KPI nasional, metrik deskriptif kawasan (`Mean`, `Median`, `IQR`, `Min–Max`, `CV %`), validasi asumsi `Shapiro–Wilk`, perbandingan `Tukey HSD`, dan rincian 38 provinsi BPS 2024 (termasuk 4 DOB Papua dengan catatan batas peta 34 provinsi).
- **Statis, Ringan & Siap Deploy:** Menggunakan HTML5, CSS3, dan Vanilla ES6+ Modules tanpa *build step* sehingga siap di-deploy ke **GitHub Pages**.

## Menjalankan Secara Lokal
Karena aplikasi memuat `./dashboard_data.json` dan `./maps/indonesia.html` melalui `fetch()`, jalankan lewat HTTP server lokal (bukan membuka `index.html` via `file://`):

```bash
python -m http.server 8000
```

Lalu buka `http://localhost:8000` di browser.

## Deploy ke GitHub Pages
1. Pastikan seluruh file (`index.html`, `css/`, `js/`, `dashboard_data.json`, `maps/indonesia.html`) berada di branch `main` (perhatikan agar tidak ada nested `.git` di subfolder saat commit).
2. Buka **Settings → Pages** di repositori GitHub, pilih **Deploy from a branch** (`main` / `/ (root)`).
3. Seluruh path aset sudah menggunakan *relative path* (`./...`) sehingga aman berjalan di subpath `https://username.github.io/repo-name/`.
