# MIRA — Integrasi Supabase (Tahap 1)

Project Supabase: `Inventory Excellence`
URL: `https://ktjcmnkutkcmyjcuqtwc.supabase.co`

## Sudah disiapkan
- `src/lib/supabase.js` menggunakan URL dan publishable key Supabase. Dapat dioverride oleh environment variables dari `.env.example`.
- `public.mira_requests`: header request, PIC pemilik, status.
- `public.mira_request_materials`: material dan qty per pengajuan.
- `public.mira_request_documents`: metadata dokumen.
- `public.mira_request_events`: riwayat keputusan/revisi.
- Supabase Storage: private bucket `mira-documents`.
- Semua tabel MIRA menggunakan Row Level Security (RLS). Hanya pemilik/pemeriksa berhak baca sesuai kebijakan; penulisan tahap lanjutan belum dibuka untuk semua tabel.

## PENTING — Status integrasi
**Belum go-live untuk multiuser.** Login `MIRARoot.jsx` masih demo via sessionStorage, bukan Supabase Auth. Form pengajuan, draft, checker, manager, dashboard, dan monitoring saat ini masih menggunakan IndexedDB browser. Jangan menafsirkan keberhasilan submit lokal sebagai bukti pengajuan telah masuk Supabase.

Jangan aktifkan sinkronisasi tulis ke database sebelum:
1. Menentukan provisioning akun PIC (NIK) dan autentikasi aman dengan Supabase Auth.
2. Menetapkan role tepercaya (PIC/Checker/Manager/Admin) di `app_metadata` atau tabel profil yang hanya dapat diubah admin.
3. Membuat endpoint/transaksi atomik untuk pembuatan header+material+dokumen+events dan transisi status; aturan RLS/Storage disesuaikan.
4. Menguji migrasi data IndexedDB agar dokumen serta Request ID lama tidak hilang.
5. Uji bersama di dua akun/perangkat sebelum mengganti penyimpanan lokal.

Tidak pernah memasukkan service_role/secret ke frontend (variabel `VITE_*` dapat dilihat pengguna).

## Tahap 2 — Login Supabase dan profil NIK (sudah dibuat)
- Tabel `public.mira_profiles` berisi `user_id` terkait `auth.users.id`, NIK unik, nama, Area, Region. RLS hanya mengizinkan pengguna membaca profil dirinya.
- Variabel `VITE_MIRA_AUTH_MODE=demo` (default) mempertahankan prototype dan IndexedDB.
- Variabel `VITE_MIRA_AUTH_MODE=supabase` mengaktifkan login email + password via `supabase.auth.signInWithPassword`.
- Admin harus membuat akun lewat Supabase Auth, mendaftarkan `mira_profiles`, dan memasang `app_metadata.mira_role` bernilai `pic`, `checker`, `manager`, atau `admin`. **Jangan** menentukan role dari input browser atau `user_metadata`.
- Setelah login nyata berhasil, saat ini MIRA hanya menampilkan halaman konfirmasi identitas. Transaksi belum diaktifkan sampai CRUD request aman selesai, karena IndexedDB demo sebelumnya berisi data lintas sesi dan tidak terisolasi per-user.
- Menu role-filter pada App disiapkan untuk tahap data online. Ini pengaturan UI, bukan keamanan server.
- Jangan memasukkan password nyata melalui login DEMO. Hanya gunakan mode Supabase setelah admin menyiapkan identitas.

### Cara menguji login Auth setelah provisioning
1. Copy `.env.example` ke `.env.local` di VS Code dan ubah `VITE_MIRA_AUTH_MODE=supabase`.
2. Restart Vite, lalu gunakan email+password akun Supabase yang didaftarkan oleh Admin.
3. Pastikan NIK dan role muncul di halaman konfirmasi login. Jika profil/role belum didaftarkan, sistem memblokir workspace.
4. Untuk menguji prototipe lama kembali, ganti ke `demo` dan restart Vite.

### Berikutnya
- Endpoint transaksi atomik submit pengajuan beserta detail material dan dokumen, dilindungi auth.uid dan RLS; dukung akses serta transisi role.
- Policy Storage private untuk PDF/Excel berdasarkan request pemilik/role.
- Migrasi request lokal ke backend dengan verifikasi Request ID, hindari menggandakan data.
- Uji login dua akun dan peran berbeda + audit trail serta dashboard.
