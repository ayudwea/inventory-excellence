import { useEffect, useMemo, useState } from "react";
import "./App.css";
import PengajuanMaterial from "./PengajuanMaterial";
import PemeriksaanChecker from "./PemeriksaanChecker";
import EvaluasiManager from "./EvaluasiManager";
import MonitoringProyek from "./MonitoringProyek";
import RiwayatAktivitas from "./RiwayatAktivitas";

const navItems = [
  ["dashboard", "Dashboard", "▣"],
  ["pengajuan", "Pengajuan Material", "▤"],
  ["checker", "Pemeriksaan Checker", "⌕"],
  ["manager", "Evaluasi Manager", "◇"],
  ["pemenuhan", "Pemenuhan Material", "▣"],
  ["monitoring", "Monitoring Proyek", "◷"],
  ["riwayat", "Riwayat Aktivitas", "☷"],
];

// Penyimpanan prototype berbasis IndexedDB: mendukung objek File PDF/Excel.
const MIRA_DB_NAME = "mira_inventory_local";
const MIRA_STORE_NAME = "state";

function openMiraDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MIRA_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MIRA_STORE_NAME)) {
        db.createObjectStore(MIRA_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredRequests() {
  const db = await openMiraDB();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(MIRA_STORE_NAME, "readonly");
      const request = transaction.objectStore(MIRA_STORE_NAME).get("requests");
      request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function saveStoredRequests(requests) {
  const db = await openMiraDB();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(MIRA_STORE_NAME, "readwrite");
      transaction.objectStore(MIRA_STORE_NAME).put(requests, "requests");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function App() {
  const [activeMenu, setActiveMenu] = useState("pengajuan");
  const [requests, setRequests] = useState([]);
  const [requestsReady, setRequestsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    readStoredRequests()
      .then((stored) => {
        if (mounted) setRequests(stored);
      })
      .catch((error) => {
        console.error("Gagal membaca request dari IndexedDB:", error);
      })
      .finally(() => {
        if (mounted) setRequestsReady(true);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!requestsReady) return;
    saveStoredRequests(requests).catch((error) => {
      console.error("Gagal menyimpan request ke IndexedDB:", error);
    });
  }, [requests, requestsReady]);

  const tanggalSekarang = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());
  }, []);

  function tambahRequest(request) {
    setRequests((prev) => [request, ...prev]);
  }

  function updateRequest(requestId, updates) {
    setRequests((prev) =>
      prev.map((item) =>
        item.requestId === requestId ? { ...item, ...updates } : item
      )
    );
  }

  const title =
    activeMenu === "checker"
      ? "Pemeriksaan Checker"
      : activeMenu === "pengajuan"
      ? "Pengajuan Material"
      : navItems.find(([id]) => id === activeMenu)?.[1];

  const subtitle =
    activeMenu === "manager"
      ? "Evaluasi pengajuan yang telah lolos pemeriksaan checker."
      : activeMenu === "checker"
      ? "Cari dan periksa pengajuan material sebelum dilanjutkan ke evaluasi."
      : activeMenu === "monitoring"
      ? "Pantau riwayat dan status pengajuan material."
      : activeMenu === "riwayat"
      ? "Lihat daftar pengajuan dan status aktivitasnya."
      : activeMenu === "pengajuan"
      ? "Input permintaan material dan dokumen pendukung."
      : "Modul MIRA Inventory Excellence.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">M</div>

            <div>
              <div className="brand-name">
                MIRA<span>.</span>
              </div>

              <div className="brand-subtitle">
                MATERIAL INTELLIGENCE &<br />
                RECONCILIATION ANALYTICS
              </div>
            </div>
          </div>

          <div className="workspace-label">WORKSPACE</div>
          <div className="menu-label">MENU UTAMA</div>

          <nav className="nav-menu">
            {navItems.map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                className={`nav-item ${activeMenu === id ? "active" : ""}`}
                onClick={() => setActiveMenu(id)}
              >
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div>
          <div className="sidebar-note">
            <div className="note-icon">✳</div>
            <strong>One platform. One view.</strong>
            <p>
              Kontrol pengajuan dan evaluasi pemenuhan material proyek dalam satu alur.
            </p>
          </div>

          <div className="admin-card">
            <div className="avatar">A</div>

            <div>
              <strong>Administrator</strong>
              <span>PT MIRA Indonesia</span>
            </div>

            <div className="admin-arrow">›</div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="date-pill">
            <span>▣</span>
            {tanggalSekarang}
          </div>
        </header>

        {!requestsReady && (
          <div className="placeholder-card">
            <p>Memuat data pengajuan lokal...</p>
          </div>
        )}

        {requestsReady && activeMenu === "pengajuan" && (
          <PengajuanMaterial
            onCreateRequest={tambahRequest}
            requests={requests}
            onUpdateRequest={updateRequest}
          />
        )}

        {requestsReady && activeMenu === "checker" && (
          <PemeriksaanChecker
            requests={requests}
            onUpdateRequest={updateRequest}
          />
        )}

        {requestsReady && activeMenu === "manager" && (
          <EvaluasiManager requests={requests} onUpdateRequest={updateRequest} />
        )}

        {requestsReady && activeMenu === "riwayat" && (
          <RiwayatAktivitas requests={requests} />
        )}

        {requestsReady && activeMenu === "monitoring" && (
          <MonitoringProyek requests={requests} />
        )}

        {!["pengajuan", "checker", "manager", "monitoring", "riwayat"].includes(activeMenu) && (
          <div className="placeholder-card">
            <h2>{title}</h2>
            <p>Halaman ini akan dibangun setelah modul Pengajuan dan Checker selesai.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
