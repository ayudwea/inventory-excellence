import { useState } from "react";
import "./MonitoringProyek.css";

const STEPS = [
  { label: "Diajukan", short: "Pengajuan diterima" },
  { label: "Pemeriksaan Checker", short: "Pemeriksaan dokumen" },
  { label: "Evaluasi Manager", short: "Keputusan evaluasi" },
  { label: "Pemenuhan Material", short: "Proses pemenuhan" },
  { label: "Selesai", short: "Permintaan selesai" },
];

function tahapStatus(request) {
  const value = String(request.status || "");
  const normalized = value.toLowerCase();
  if (normalized.includes("diganti")) return { index: 0, stopped: true, label: "Diganti" };
  if (normalized.includes("ditolak checker")) return { index: 1, stopped: true, label: value };
  if (normalized.includes("ditolak manager")) return { index: 2, stopped: true, label: value };
  if (normalized.includes("menunggu pemeriksaan") || normalized.includes("checker")) return { index: 1, stopped: false, label: value };
  if (normalized.includes("menunggu evaluasi") || normalized.includes("manager")) return { index: 2, stopped: false, label: value };
  if (normalized.includes("pemenuhan") || normalized.includes("proses material")) return { index: 3, stopped: false, label: value };
  if (normalized.includes("selesai") || normalized.includes("terpenuhi")) return { index: 4, stopped: false, label: value };
  return { index: 0, stopped: false, label: value || "Diajukan" };
}

function tanggal(value) {
  if (!value) return "-";
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function TimelineStatus({ request }) {
  const current = tahapStatus(request);
  return (
    <ol className="mira-status-timeline" aria-label="Tahapan pengajuan material">
      {STEPS.map((step, index) => {
        const completed = index < current.index;
        const active = index === current.index;
        return (
          <li key={step.label} className={`mira-status-step ${completed ? "completed" : ""} ${active ? (current.stopped ? "stopped" : "active") : ""}`}>
            <span className="mira-status-step-dot">{completed ? "✓" : active && current.stopped ? "!" : index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{active && current.stopped ? "Proses tidak dilanjutkan" : step.short}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function MonitoringProyek({ requests = [] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("SEMUA");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = requests.filter((request) => {
    const query = search.trim().toLowerCase();
    const matches = !query || [request.requestId, request.pekerjaan, request.gudang, request.jenisPermintaan]
      .some((field) => String(field || "").toLowerCase().includes(query));
    const state = tahapStatus(request);
    return matches && (filter === "SEMUA" || (filter === "PERLU TINDAK LANJUT" ? state.stopped : request.status === filter));
  });
  const currentRequest = requests.find((item) => item.requestId === selectedId);
  const statusOptions = Array.from(new Set(requests.map((request) => request.status).filter(Boolean)));
  const countPending = requests.filter((request) => {
    const state = tahapStatus(request);
    return !state.stopped && state.index < 4;
  }).length;
  const countReview = requests.filter((request) => tahapStatus(request).stopped).length;
  const countDone = requests.filter((request) => tahapStatus(request).index === 4).length;

  return (
    <section className="pengajuan-history-card monitoring-page" aria-label="Monitoring Proyek">
      <div className="pengajuan-history-header">
        <div>
          <span>TRACKING PERMINTAAN</span>
          <h2>Monitoring Status Pengajuan</h2>
          <p>Cari Request ID dan lihat posisi pengajuan pada setiap tahapan.</p>
        </div>
        <span className="pengajuan-history-count">{requests.length} Pengajuan</span>
      </div>
      <div className="mira-status-summary">
        <div><span>Total pengajuan</span><strong>{requests.length}</strong></div>
        <div><span>Dalam proses</span><strong>{countPending}</strong></div>
        <div><span>Ditolak / diganti</span><strong>{countReview}</strong></div>
        <div><span>Selesai</span><strong>{countDone}</strong></div>
      </div>
      <div className="pengajuan-history-filter">
        <input aria-label="Cari nomor atau nama pekerjaan" placeholder="Cari No. Request, gudang, pekerjaan..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter status pengajuan" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="SEMUA">Semua Status</option>
          <option value="PERLU TINDAK LANJUT">Ditolak / diganti</option>
          {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {filtered.length > 0 ? (
        <div className="mira-monitor-list">
          {filtered.map((request) => {
            const state = tahapStatus(request);
            return (
              <article key={request.requestId} className="mira-monitor-item">
                <div className="mira-monitor-item-top">
                  <div>
                    <strong>{request.requestId}</strong>
                    <p>{request.pekerjaan || "-"} · {request.gudang || "-"} · {request.jenisPermintaan || request.tipePermintaan || "-"}</p>
                    <small>Diajukan: {tanggal(request.tanggalInput)} · {request.materials?.length || 0} material</small>
                  </div>
                  <span className={`mira-monitor-status ${state.stopped ? "is-stopped" : ""}`}>{state.label}</span>
                </div>
                <div className="mira-monitor-progress" role="progressbar" aria-label={`Progres ${request.requestId}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={state.index * 25}>
                  <span style={{ width: `${state.index * 25}%` }} />
                </div>
                <div className="mira-monitor-item-footer">
                  <small>Tahap: {STEPS[state.index].label}{state.stopped ? " — tidak dilanjutkan" : ""}</small>
                  <button type="button" onClick={() => setSelectedId((old) => old === request.requestId ? null : request.requestId)}>
                    {selectedId === request.requestId ? "Tutup Tracking" : "Lihat Tracking"}
                  </button>
                </div>
                {selectedId === request.requestId && (
                  <div className="mira-monitor-detail">
                    <TimelineStatus request={request} />
                    {state.stopped && (
                      <div className="mira-monitor-reason">
                        <strong>Perhatian: pengajuan tidak dilanjutkan</strong>
                        <p>{request.catatanChecker || request.alasanTolakManager || (request.digantiOleh ? `Diganti oleh ${request.digantiOleh}.` : "Periksa detail pengajuan atau hubungi tim pemeriksa.")}</p>
                      </div>
                    )}
                    {!state.stopped && state.index < 4 && (
                      <p className="mira-monitor-next">Tahap berikutnya: <strong>{STEPS[Math.min(state.index + 1, 4)].label}</strong>. Status akan diperbarui saat proses berlanjut.</p>
                    )}
                    {request.catatanManager && <p className="mira-monitor-next">Catatan Manager: {request.catatanManager}</p>}
                    {request.checkedAt && <p className="mira-monitor-meta">Diperiksa Checker: {tanggal(request.checkedAt)}</p>}
                    {request.managerEvaluatedAt && <p className="mira-monitor-meta">Dievaluasi Manager: {tanggal(request.managerEvaluatedAt)}</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pengajuan-history-empty">
          {requests.length ? "Tidak ada pengajuan yang sesuai pencarian atau filter." : "Belum ada pengajuan. Data tracking akan muncul setelah pengajuan disubmit."}
        </div>
      )}
      <p className="pengajuan-history-footnote">Mode frontend demo: status berasal dari data permintaan di browser ini. Tahap Pemenuhan dan Selesai akan aktif setelah modul pemenuhan terhubung.</p>
    </section>
  );
}
