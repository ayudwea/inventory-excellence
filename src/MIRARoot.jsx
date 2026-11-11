import { useState } from "react";
import App from "./App.jsx";
import LoginMIRA from "./LoginMIRA.jsx";
import "./LoginMIRA.css";

const SESSION_KEY = "mira_frontend_demo_session";

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

/** Demo UI gate. NOT authentication or a security boundary. */
export default function MIRARoot() {
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

  if (!demoUser) return <LoginMIRA onLogin={login} />;

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
