import { useState } from "react";
import "../LoginMIRA.css";

/**
 * MIRA sign-in UI (frontend-only).
 *
 * onLogin: optional async callback, called with { nik, password }.
 *   Connect this to a REAL authentication endpoint before production use.
 *   Do not store NIK/password in localStorage or bypass authentication.
 *
 * Without onLogin, the form displays a clear demo-only message and NEVER
 * grants access to any authenticated page.
 */
export default function LoginMIRA({ onLogin }) {
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validNik = /^[0-9]{4,20}$/.test(nik);
  const canSubmit = validNik && password.length > 0 && !loading;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!validNik) {
      setError("Masukkan NIK berupa 4–20 digit angka.");
      return;
    }
    if (!password) {
      setError("Password wajib diisi.");
      return;
    }
    if (typeof onLogin !== "function") {
      setMessage("Ini adalah tampilan login (demo). Autentikasi NIK belum terhubung ke backend.");
      return;
    }

    setLoading(true);
    try {
      // Authentication must be checked on the server by the supplied callback.
      await onLogin({ nik, password });
    } catch (err) {
      setError(err?.message || "Login gagal. Periksa NIK dan password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mira-login-page">
      <section className="mira-login-hero" aria-label="Tentang MIRA">
        <div className="mira-login-hero-content">
          <div className="mira-login-brand">
            <div className="mira-login-brand-mark" aria-hidden="true">M</div>
            <div className="mira-login-brand-wordmark">
              <strong>MIRA<span>.</span></strong>
              <small>MATERIAL INTELLIGENCE &amp;<br />RECONCILIATION ANALYTICS</small>
            </div>
          </div>

          <div className="mira-login-welcome">
            <p className="mira-login-eyebrow">INVENTORY EXCELLENCE PLATFORM</p>
            <h1>Welcome back<span>.</span></h1>
            <p>Manage material requests, checker review, manager evaluation, and monitoring in one platform.</p>
          </div>

          <div className="mira-login-features" aria-label="Modul MIRA">
            <div className="mira-login-feature"><span aria-hidden="true">▣</span><p>Material<br />Request</p></div>
            <div className="mira-login-feature"><span aria-hidden="true">✓</span><p>Checker<br />Review</p></div>
            <div className="mira-login-feature"><span aria-hidden="true">◇</span><p>Manager<br />Evaluation</p></div>
            <div className="mira-login-feature"><span aria-hidden="true">▥</span><p>Monitoring<br />&amp; Analytics</p></div>
          </div>
        </div>
        <div className="mira-login-wave" aria-hidden="true" />
        <p className="mira-login-hero-footer">MIRA · Material Intelligence &amp; Reconciliation Analytics</p>
      </section>

      <section className="mira-login-panel" aria-label="Login MIRA">
        <div className="mira-login-card">
          <div className="mira-login-tag"><span aria-hidden="true">◇</span> Internal Use Only</div>
          <p className="mira-login-card-eyebrow">WELCOME TO MIRA</p>
          <h2>Sign in to MIRA</h2>
          <p className="mira-login-description">Masuk menggunakan NIK karyawan untuk mengakses sistem Inventory Excellence.</p>

          <form className="mira-login-form" onSubmit={handleSubmit} noValidate>
            <div className="mira-login-field">
              <label htmlFor="mira-nik">NIK Karyawan <span>*</span></label>
              <div className="mira-login-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.7 16c.6-1.6 2-2.5 3.3-2.5S11.8 14.4 12.3 16M15 10h4M15 14h4"/></svg>
                <input id="mira-nik" name="nik" type="text" inputMode="numeric" autoComplete="username" placeholder="Masukkan NIK karyawan" maxLength={20} value={nik} onChange={(e) => { setNik(e.target.value.replace(/\D/g, "")); setError(""); setMessage(""); }} aria-invalid={Boolean(nik && !validNik)} required />
              </div>
            </div>

            <div className="mira-login-field">
              <label htmlFor="mira-password">Password <span>*</span></label>
              <div className="mira-login-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                <input id="mira-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); setMessage(""); }} required />
                <button className="mira-login-eye" type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 3l18 18M10.8 5.2A10.5 10.5 0 0 1 12 5c5 0 9 7 9 7a15 15 0 0 1-3.5 4M6.2 6.2C3.9 8 3 12 3 12s4 7 9 7c1.4 0 2.7-.4 3.9-1.1M10 10a3 3 0 0 0 4 4"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="mira-login-alert mira-login-alert-error">{error}</p>}
            {message && <p role="status" className="mira-login-alert mira-login-alert-info">{message}</p>}

            <button type="submit" className="mira-login-submit" disabled={!canSubmit}>{loading ? "Memverifikasi..." : "Masuk ke MIRA"}<span aria-hidden="true">→</span></button>
          </form>

          <div className="mira-login-bottom">
            <p>Belum punya akun atau lupa password?</p>
            <strong>Hubungi Administrator MIRA</strong>
          </div>
        </div>
        <p className="mira-login-copyright">© {new Date().getFullYear()} MIRA · Internal Inventory Excellence Platform</p>
      </section>
    </main>
  );
}
