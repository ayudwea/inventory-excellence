import { useEffect, useState } from "react";
import App from "./App.jsx";
import LoginMIRA from "./LoginMIRA.jsx";
import { supabase } from "./lib/supabase.js";
import "./LoginMIRA.css";

// Demo default dipertahankan untuk menjaga prototype selama integrasi backend.
const SESSION_KEY = "mira_frontend_demo_session";
const USE_SUPABASE_AUTH = import.meta.env.VITE_MIRA_AUTH_MODE === "supabase";

function initialDemoUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value?.nik ? { nik: String(value.nik) } : null;
  } catch {
    return null;
  }
}

function DemoWorkspace() {
  const [demoUser, setDemoUser] = useState(initialDemoUser);

  function login({ nik }) {
    const user = { nik };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setDemoUser(user);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setDemoUser(null);
  }

  if (!demoUser) return <LoginMIRA onLogin={login} mode="demo" />;
  return (
    <>
      <App />
      <div className="mira-demo-session" role="status">
        <span>DEMO · NIK {demoUser.nik}</span>
        <button type="button" onClick={logout}>Keluar</button>
      </div>
    </>
  );
}

function SupabaseWorkspace() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAuthenticatedUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (active) { setUser(null); setProfile(null); setAuthError(""); }
          return;
        }
        // NIK diambil setelah user terautentikasi; tidak diekspos sebagai direktori publik.
        const { data: savedProfile, error: profileError } = await supabase
          .from("mira_profiles")
          .select("nik, display_name, area, region")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!active) return;
        setUser(data.user);
        setProfile(savedProfile || null);
        setAuthError(profileError ? "Tidak dapat mengambil profil MIRA." : "");
      } catch (error) {
        if (active) setAuthError(error.message || "Gagal memuat sesi pengguna.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAuthenticatedUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      // Avoid calling the Supabase client synchronously within this callback.
      Promise.resolve().then(() => { if (active) loadAuthenticatedUser(); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error("Login gagal. Periksa email, password, atau status akun Supabase.");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError("Gagal keluar dari akun. Coba lagi.");
  }

  if (loading) return <div className="mira-auth-wait">Memeriksa sesi Supabase...</div>;
  if (!user) return <LoginMIRA onLogin={signIn} mode="supabase" />;

  // User tanpa profil atau role belum boleh membuka workspace MIRA.
  const role = user.app_metadata?.mira_role;
  const roleValid = ["pic", "checker", "manager", "admin"].includes(role);
  if (!profile || !roleValid) {
    return (
      <div className="mira-auth-unprovisioned">
        <div>
          <h2>Akun belum diaktifkan di MIRA</h2>
          <p>Login berhasil, tetapi profil NIK atau hak akses belum didaftarkan oleh Admin.</p>
          {authError && <p role="alert">{authError}</p>}
          <button type="button" onClick={signOut}>Keluar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <App currentRole={role} />
      <div className="mira-demo-session" role="status">
        <span>{role.toUpperCase()} · NIK {profile.nik}</span>
        <button type="button" onClick={signOut}>Keluar</button>
      </div>
    </>
  );
}

export default function MIRARoot() {
  return USE_SUPABASE_AUTH ? <SupabaseWorkspace /> : <DemoWorkspace />;
}
