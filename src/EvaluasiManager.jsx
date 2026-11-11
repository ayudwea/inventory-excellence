import { useMemo, useState } from "react";
import "./EvaluasiManager.css";
import { getDummyStock } from "./data/masterStokDummy";

const alasanTolakManagerOptions = [
  "Data Pengajuan Belum Sesuai",
  "Dokumen Pendukung Belum Memadai",
  "Perlu Klarifikasi Lebih Lanjut",
  "QTY Pengajuan Belum Disetujui",
  "Pengajuan Belum Dapat Diproses",
];

function normalizeMaterialCode(value) {
  const code = String(value ?? "").trim();
  return /^\d+$/.test(code) ? code.replace(/^0+(?=\d)/, "") : code;
}

function EvaluasiManager({ requests, onUpdateRequest }) {
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [catatanManager, setCatatanManager] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");

  const waitingRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status === "Menunggu Evaluasi Manager"
      ),
    [requests]
  );

  const detail = useMemo(
    () =>
      waitingRequests.find(
        (request) => request.requestId === selectedRequestId
      ) || null,
    [waitingRequests, selectedRequestId]
  );

  const sapQtyByMaterial = useMemo(() => {
    const headers = detail?.snapshots?.dataStokSapHeaders || [];
    const rows = detail?.snapshots?.dataStokSapRows || [];
    const materialIndex = headers.indexOf("Material");
    const unrestrictedIndex = headers.indexOf("Unrestricted");
    const quantities = new Map();

    if (materialIndex < 0 || unrestrictedIndex < 0) return quantities;

    rows.forEach((row) => {
      const materialCode = normalizeMaterialCode(row[materialIndex]);
      const rawQuantity = String(row[unrestrictedIndex] ?? "").trim();
      if (!materialCode || !rawQuantity) return;

      const quantity = Number(rawQuantity.replace(/,/g, ""));
      if (!Number.isFinite(quantity)) return;

      quantities.set(
        materialCode,
        (quantities.get(materialCode) || 0) + quantity
      );
    });

    return quantities;
  }, [detail]);

  const stats = useMemo(() => {
    if (!detail) {
      return {
        totalMaterial: 0,
        mismatch: 0,
        dokumenLengkap: 0,
        totalDokumenWajib: 0,
      };
    }

    const mismatch = detail.materials.filter((item) => {
      const ba = Number(item.baQty || 0);
      const boq = Number(item.boqQty || 0);
      return ba !== boq;
    }).length;

    const dokumenWajib =
      detail.jenisPermintaan === "RECURRING"
        ? [detail.files?.ba]
        : [detail.files?.spk, detail.files?.boq, detail.files?.ba];

    return {
      totalMaterial: detail.materials.length,
      mismatch,
      dokumenLengkap: dokumenWajib.filter(Boolean).length,
      totalDokumenWajib: dokumenWajib.length,
    };
  }, [detail]);

  function formatTanggal(dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString);

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: dateString.includes("T") ? "2-digit" : undefined,
      minute: dateString.includes("T") ? "2-digit" : undefined,
    }).format(date);
  }

  function prosesManager(action) {
    if (!detail) return;

    if (action === "tolak" && !alasanTolak) {
      alert("Pilih alasan penolakan terlebih dahulu.");
      return;
    }

    const actionLabel = action === "approve" ? "menyetujui" : "menolak";

    const yakin = window.confirm(
      `Yakin ingin ${actionLabel} ${detail.requestId}?`
    );

    if (!yakin) return;

    onUpdateRequest(detail.requestId, {
      status:
        action === "approve"
          ? "Menunggu Pemenuhan Material"
          : "Ditolak Manager",
      alasanTolakManager: action === "tolak" ? alasanTolak : "",
      catatanManager: catatanManager.trim(),
      managerName: "Manager",
      managerEvaluatedAt: new Date().toISOString(),
    });

    setSelectedRequestId("");
    setAlasanTolak("");
    setCatatanManager("");
  }

  function updateManagerMaterial(index, field, value) {
    if (!detail) return;

    onUpdateRequest(detail.requestId, {
      materials: detail.materials.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    });
  }

  function managerMaterialInput(item, index, field, label) {
    const value = item[field] ?? item[field.toUpperCase()] ?? "";
    return (
      <input
        className="manager-material-input"
        aria-label={`${label} material ${item.kode || index + 1}`}
        value={value}
        onChange={(event) =>
          updateManagerMaterial(index, field, event.target.value)
        }
      />
    );
  }

  return (
    <>
      <section className="checker-card manager-workspace">
        <div className="checker-intro compact">
          <div>
            <span className="checker-kicker">EVALUASI MANAGER</span>
            <h2>Evaluasi Pengajuan Material</h2>
            <p>
              Pilih pengajuan yang telah lolos pemeriksaan checker untuk
              dilakukan evaluasi manager.
            </p>
          </div>

          <div className="checker-pending-badge">
            {waitingRequests.length} Menunggu
          </div>
        </div>

        <div className="checker-picker">
          <div className="field">
            <label>Request ID</label>

            <select
              value={selectedRequestId}
              onChange={(e) => {
                setSelectedRequestId(e.target.value);
                setCatatanManager("");
                setAlasanTolak("");
              }}
            >
              <option value="">Pilih Request ID</option>

              {waitingRequests.map((request) => (
                <option
                  key={request.requestId}
                  value={request.requestId}
                >
                  {request.requestId} | {request.gudang} | {request.pekerjaan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!detail ? (
          <div className="checker-empty compact-empty">
            <div className="checker-empty-icon">◇</div>
            <strong>Pilih pengajuan yang akan dievaluasi</strong>
            <span>
              Detail pengajuan akan tampil otomatis setelah Request ID dipilih.
            </span>
          </div>
        ) : (
          <div className="checker-inline-detail">
            <div className="checker-inline-header">
              <div>
                <span className="checker-kicker">DETAIL PENGAJUAN</span>
                <h3>{detail.requestId}</h3>
                <p>
                  {detail.jenisPermintaan} • {detail.gudang} •{" "}
                  {detail.pekerjaan}
                </p>
              </div>

              <span className="checker-inline-status">
                {detail.status}
              </span>
            </div>

            <div className="manager-checker-result">
              <div className="manager-checker-icon">✓</div>

              <div>
                <span>HASIL PEMERIKSAAN CHECKER</span>
                <strong>Lolos Pemeriksaan Checker</strong>
                <p>
                  Diperiksa oleh {detail.checkerName || "Administrator"}
                  {detail.checkedAt
                    ? ` • ${formatTanggal(detail.checkedAt)}`
                    : ""}
                </p>
              </div>
            </div>

            <div className="checker-summary-grid">
              <div className="checker-summary-card">
                <span>Tanggal Input</span>
                <strong>{formatTanggal(detail.tanggalInput)}</strong>
              </div>

              <div className="checker-summary-card">
                <span>Total Material</span>
                <strong>{stats.totalMaterial} item</strong>
              </div>

              <div className="checker-summary-card">
                <span>Dokumen</span>
                <strong
                  className={
                    stats.dokumenLengkap === stats.totalDokumenWajib
                      ? "summary-good"
                      : "summary-bad"
                  }
                >
                  {stats.dokumenLengkap}/{stats.totalDokumenWajib}{" "}
                  {stats.dokumenLengkap === stats.totalDokumenWajib
                    ? "Lengkap"
                    : "Belum Lengkap"}
                </strong>
              </div>

              <div className="checker-summary-card">
                <span>Mismatch BA / BOQ</span>
                <strong
                  className={
                    stats.mismatch === 0 ? "summary-good" : "summary-bad"
                  }
                >
                  {stats.mismatch} material
                </strong>
              </div>
            </div>

            <div className="checker-detail-section">
              <h3>Daftar Material</h3>

              <div className="checker-material-table">
                <div className="checker-material-grid checker-material-head">
                  <div>No</div>
                  <div>Kode Material</div>
                  <div>Satuan</div>
                  <div>BOQ QTY</div>
                  <div>BA QTY</div>
                  <div>LOT_SIZE</div>
                  <div>MONTHLY_DEMAND</div>
                  <div>ROP</div>
                  <div>EOQ</div>
                  <div>SAP_QTY</div>
                  <div>PO_QTY</div>
                  <div>PR_QTY</div>
                  <div>TOTAL</div>
                  <div>GAP</div>
                  <div>Pemenuhan</div>
                  <div>PO</div>
                  <div>TAG</div>
                  <div>DONOR</div>
                </div>

                {detail.materials.map((item, index) => {
                  const sapQty =
                    sapQtyByMaterial.get(normalizeMaterialCode(item.kode)) ??
                    item.sapQty ??
                    item.sap_qty ??
                    item.SAP_QTY ??
                    getDummyStock(detail.gudang, item.kode)?.sapQty ??
                    "—";

                  return (
                    <div
                      className="checker-material-grid checker-material-row"
                      key={`${item.kode}-${index}`}
                    >
                      <div>{index + 1}</div>
                      <div>{item.kode || "-"}</div>
                      <div>{item.satuan || "-"}</div>
                      <div>{item.boqQty ?? item.BOQ_QTY ?? "-"}</div>
                      <div>{item.baQty ?? item.BA_QTY ?? "-"}</div>
                      <div>{item.lotSize ?? item.lot_size ?? item.LOT_SIZE ?? "-"}</div>
                      <div>{item.monthlyDemand ?? item.monthly_demand ?? item.MONTHLY_DEMAND ?? "-"}</div>
                      <div>{item.rop ?? item.ROP ?? "-"}</div>
                      <div>{item.eoq ?? item.EOQ ?? "-"}</div>
                      <div>{sapQty}</div>
                      <div>{item.poQty ?? item.po_qty ?? item.PO_QTY ?? "-"}</div>
                      <div>{item.prQty ?? item.pr_qty ?? item.PR_QTY ?? "-"}</div>
                      <div>{item.total ?? item.TOTAL ?? "-"}</div>
                      <div>{item.gap ?? item.GAP ?? "-"}</div>
                      <div className="manager-value-cell">{managerMaterialInput(item, index, "pemenuhan", "Pemenuhan")}</div>
                      <div className="manager-value-cell">{managerMaterialInput(item, index, "po", "PO")}</div>
                      <div className="manager-value-cell">{managerMaterialInput(item, index, "tag", "TAG")}</div>
                      <div className="manager-donor-cell">{managerMaterialInput(item, index, "donor", "Donor")}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="checker-detail-section">
              <div className="checker-note-title">
                <h3>Evaluasi Manager</h3>
                <span>* alasan wajib jika ditolak</span>
              </div>

              <div className="manager-form-grid">
                <div>
                  <label>Alasan Ditolak</label>
                  <select
                    className="checker-reject-reason"
                    value={alasanTolak}
                    onChange={(e) => setAlasanTolak(e.target.value)}
                  >
                    <option value="">Pilih alasan penolakan</option>

                    {alasanTolakManagerOptions.map((alasan) => (
                      <option key={alasan} value={alasan}>
                        {alasan}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Catatan Manager</label>
                  <textarea
                    className="manager-note"
                    value={catatanManager}
                    onChange={(e) => setCatatanManager(e.target.value)}
                    placeholder="Tambahkan catatan jika diperlukan..."
                  />
                </div>
              </div>
            </div>

            <div className="manager-action-bar">
              <div>
                <span>Keputusan Manager</span>
                <p>
                  Pastikan data pengajuan sudah sesuai sebelum memberikan
                  keputusan.
                </p>
              </div>

              <div className="checker-inline-actions">
                <button
                  type="button"
                  className="checker-reject-btn"
                  onClick={() => prosesManager("tolak")}
                >
                  Tolak
                </button>

                <button
                  type="button"
                  className="checker-approve-btn"
                  onClick={() => prosesManager("approve")}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

    </>
  );
}

export default EvaluasiManager;
