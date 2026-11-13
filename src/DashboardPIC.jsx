import { useMemo, useState } from "react";
import "./DashboardPIC.css";

const cards = [
  { id: "SEMUA", label: "Total Pengajuan" },
  { id: "CHECKER", label: "Menunggu Checker" },
  { id: "MANAGER", label: "Menunggu Manager" },
  { id: "PEMENUHAN", label: "Proses Pemenuhan" },
  { id: "REVISI", label: "Perlu Revisi" },
  { id: "SELESAI", label: "Selesai" },
];

function kategori(request) {
  const status = String(request.status || "").toLowerCase();
  if (status === "ditolak checker") return "REVISI";
  if (status.includes("menunggu pemeriksaan")) return "CHECKER";
  if (status.includes("menunggu evaluasi")) return "MANAGER";
  if (status.includes("pemenuhan")) return "PEMENUHAN";
  if (status.includes("selesai") || status.includes("terpenuhi")) return "SELESAI";
  return "LAINNYA";
}

function tanggal(value) {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day:"2-digit", month:"short", year:"numeric" });
}

export default function DashboardPIC({ requests = [], onMenuChange, onReviseRequest }) {
  const [filter, setFilter] = useState("SEMUA");
  const [search, setSearch] = useState("");
  const counters = useMemo(() => Object.fromEntries(cards.map((card) => [
    card.id,
    card.id === "SEMUA" ? requests.length : requests.filter((request) => kategori(request) === card.id).length,
  ])), [requests]);

  const displayed = requests.filter((request) => {
    const matchesFilter = filter === "SEMUA" || kategori(request) === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [request.requestId, request.pekerjaan, request.gudang, request.status].some(
      (value) => String(value || "").toLowerCase().includes(term)
    );
    return matchesFilter && matchesSearch;
  }).sort((a, b) => String(b.tanggalInput || "").localeCompare(String(a.tanggalInput || "")));

  return (
    <section className="mira-pic-dashboard" aria-label="Dashboard PIC Area">
      <div className="mira-pic-dashboard-head">
        <div>
          <span>DASHBOARD PENGAJUAN</span>
          <h2>Ringkasan Permintaan Material</h2>
          <p>Pantau pengajuan dan tindak lanjut yang diperlukan dari satu halaman.</p>
        </div>
        <button type="button" onClick={() => onMenuChange?.("pengajuan")}>+ BUAT PENGAJUAN</button>
      </div>
      <div className="mira-pic-metrics">
        {cards.map((card) => (
          <button key={card.id} type="button" className={`mira-pic-metric ${filter === card.id ? "selected" : ""}`} onClick={() => setFilter(card.id)}>
            <span>{card.label}</span>
            <strong>{counters[card.id]}</strong>
            <small>{filter === card.id ? "Filter aktif" : "Klik untuk melihat"}</small>
          </button>
        ))}
      </div>
      <div className="mira-pic-dashboard-head mira-pic-list-head">
        <div>
          <h3>Daftar Pengajuan</h3>
          <p>{displayed.length} dari {requests.length} pengajuan ditampilkan</p>
        </div>
        <button type="button" className="mira-pic-tracking-link" onClick={() => onMenuChange?.("monitoring")}>LIHAT TRACKING →</button>
      </div>
      <div className="mira-pic-filters">
        <input aria-label="Cari pengajuan" placeholder="Cari Request ID, gudang, pekerjaan..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filter tahap pengajuan" value={filter} onChange={(event) => setFilter(event.target.value)}>
          {cards.map((card) => <option key={card.id} value={card.id}>{card.label}</option>)}
          <option value="LAINNYA">Status lainnya</option>
        </select>
      </div>
      <div className="mira-pic-request-list">
        {displayed.length ? displayed.map((request) => (
          <article key={request.requestId} className="mira-pic-request">
            <div className="mira-pic-request-main">
              <strong>{request.requestId}</strong>
              <p>{request.pekerjaan || "-"} · {request.gudang || "-"} · {request.jenisPermintaan || request.tipePermintaan || "-"}</p>
              <small>{tanggal(request.tanggalInput)} · {request.materials?.length || 0} material</small>
            </div>
            <div className="mira-pic-request-actions">
              <span className={`mira-pic-state ${kategori(request)==="REVISI" ? "needs-revision":""}`}>{request.status || "Diajukan"}</span>
              {kategori(request)==="REVISI" ? (
                <button type="button" onClick={() => onReviseRequest?.(request.requestId)}>REVISI SEKARANG</button>
              ) : (
                <button type="button" onClick={() => onMenuChange?.("monitoring")}>LIHAT STATUS</button>
              )}
            </div>
          </article>
        )) : (
          <div className="mira-pic-empty">{requests.length ? "Tidak ada pengajuan sesuai filter." : "Belum ada permintaan material. Klik Buat Pengajuan untuk memulai."}</div>
        )}
      </div>
      <p className="mira-pic-footnote">Mode frontend demo: ringkasan ini memakai data dari browser yang sama, belum dibatasi berdasarkan akun PIC. Hak akses per PIC akan diterapkan saat backend siap.</p>
    </section>
  );
}
