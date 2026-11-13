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
