import { useState } from "react";
import "./LoginMIRA.css";

/**
 * UI DEMO ONLY. Does not authenticate or authorize users.
 * Replace onLogin with Supabase Auth / corporate SSO before production.
 */
export default function LoginMIRA({ onLogin, mode = "demo" }) {
  const [nik, setNik] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  const nikValid = /^[A-Za-z0-9]{5,20}$/.test(nik.trim());
  const passwordValid = password.length >= 6;
  const isSupabase = mode === "supabase";
  const canSubmit = (isSupabase ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) : nikValid) && passwordValid;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!canSubmit || submitting) {
      setError(isSupabase ? "Masukkan email yang valid dan password minimal 6 karakter." : "Masukkan NIK (5–20 karakter huruf/angka) dan password minimal 6 karakter.");
      return;
    }
    setSubmitting(true);
    try {
      await onLogin?.(isSupabase
        ? { email: email.trim(), password }
        : { nik: nik.trim(), displayName: "Pengguna Demo", remember });
      setPassword("");
    } catch (err) {
      setError(err.message || "Tidak dapat masuk. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mira-login">
      <section className="mira-login-brand" aria-label="Tentang MIRA">
        <div className="mira-login-brand-inner">
          <div className="mira-login-logo-row">
            <div className="mira-login-monogram">M</div>
            <div>
              <div className="mira-login-wordmark">MIRA<span>.</span></div>
              <div className="mira-login-fullname">MATERIAL INTELLIGENCE &amp;<br />RECONCILIATION ANALYTICS</div>
            </div>
          </div>
          <div className="mira-login-welcome">
            <div className="mira-login-eyebrow">INVENTORY EXCELLENCE PLATFORM</div>
            <h1>Welcome back.</h1>
            <p>Satu platform untuk pengajuan material, pemeriksaan, evaluasi, dan monitoring.</p>
            <div className="mira-login-capabilities" aria-label="Fitur utama">
              <div><span>▤</span><strong>Material<br />Request</strong></div>
              <div><span>✓</span><strong>Checker<br />Review</strong></div>
              <div><span>◇</span><strong>Manager<br />Evaluation</strong></div>
              <div><span>▥</span><strong>Monitoring<br />&amp; Analytics</strong></div>
            </div>
          </div>
          <div className="mira-login-brand-bottom">MIRA — INTERNAL WORKSPACE</div>
        </div>
      </section>

      <main className="mira-login-right">
        <div className="mira-login-card">
          <div className="mira-login-tag">♧ &nbsp; Internal Use Only</div>
          <div className="mira-login-kicker">WELCOME TO MIRA</div>
          <h2>Sign in to MIRA</h2>
          <p className="mira-login-lead">{isSupabase ? "Masuk dengan email akun Supabase yang sudah didaftarkan Admin dan terhubung dengan NIK." : "Masuk menggunakan NIK karyawan untuk mengakses workspace Inventory Excellence."}</p>
          <div className="mira-login-demo-banner" role="note">{isSupabase ? "Mode Supabase Auth — gunakan akun yang diberikan Admin. Profil NIK dan peran harus sudah aktif." : "Mode Demo Frontend — belum terhubung ke autentikasi perusahaan."}</div>

          <form onSubmit={submit} noValidate>
            <label htmlFor="mira-nik">{isSupabase ? "Email Akun Supabase" : "NIK Karyawan"} <span>*</span></label>
            <div className="mira-login-control">
              <span className="mira-login-input-icon" aria-hidden="true">▣</span>
              {isSupabase ? (
                <input id="mira-nik" type="email" autoComplete="username" placeholder="nama@perusahaan.com"
                  value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} />
              ) : (
                <input id="mira-nik" type="text" inputMode="text" autoComplete="username"
                  placeholder="Masukkan NIK karyawan" value={nik} maxLength={20}
                  onChange={(e) => { setNik(e.target.value.replace(/[^a-zA-Z0-9]/g, "")); setError(""); }} />
              )}
            </div>
            <div className="mira-login-hint">{isSupabase ? "NIK dan role akan dibaca dari profil setelah berhasil login." : "5–20 karakter, huruf atau angka."}</div>

            <label htmlFor="mira-password">Password <span>*</span></label>
            <div className="mira-login-control">
              <span className="mira-login-input-icon" aria-hidden="true">♙</span>
              <input
                id="mira-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => {setPassword(e.target.value);setError("");}}
              />
              <button type="button" className="mira-login-eye" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShowPassword((s) => !s)}>
                {showPassword ? "Sembunyikan" : "Lihat"}
              </button>
            </div>
            <div className="mira-login-options">
              <label className="mira-login-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Ingat NIK di sesi demo</label>
              <span className="mira-login-forgot">Reset password melalui admin</span>
            </div>
            {error && <p className="mira-login-error" role="alert">{error}</p>}
            <button className="mira-login-submit" type="submit" disabled={!canSubmit || submitting}>{submitting ? "Memverifikasi..." : "Masuk ke Workspace"} <span aria-hidden="true">→</span></button>
          </form>
          <p className="mira-login-footnote">{isSupabase ? "Login menggunakan Supabase Auth. Jangan bagikan password kepada siapa pun." : "Untuk demo UI, gunakan NIK contoh dan password minimal 6 karakter. Password tidak dikirim ke server atau disimpan."}</p>
        </div>
        <div className="mira-login-copyright">© 2026 MIRA · Material Intelligence &amp; Reconciliation Analytics</div>
      </main>
    </div>
  );
}
