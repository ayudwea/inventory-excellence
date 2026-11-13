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

  function nilaiMaterial(item, ...fields) {
    for (const field of fields) {
      const value = item[field];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  }

  function tampilAngka(value) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("id-ID", { maximumFractionDigits: 3 })
      : String(value);
  }

  function statusPemenuhan(item) {
    const value = String(nilaiMaterial(item, "pemenuhan", "PEMENUHAN") || "").toUpperCase().trim();
    return ["DIPENUHI", "TIDAK DIPENUHI"].includes(value) ? value : "";
  }

  function managerMaterialInput(item, index, field, label) {
    const value = nilaiMaterial(item, field, field.toUpperCase()) ?? "";
    return (
      <input
        className="manager-material-input"
        type={field === "donor" ? "text" : "number"}
        min={field === "donor" ? undefined : 0}
        step={field === "donor" ? undefined : "any"}
        placeholder={field === "donor" ? "Gudang donor" : "0"}
        aria-label={`${label} material ${item.kode || index + 1}`}
        value={value}
        onChange={(event) => updateManagerMaterial(index, field, event.target.value)}
      />
    );
  }

  const jumlahDipenuhi = detail?.materials.filter((item) => statusPemenuhan(item) === "DIPENUHI").length || 0;
  const jumlahTidakDipenuhi = detail?.materials.filter((item) => statusPemenuhan(item) === "TIDAK DIPENUHI").length || 0;
  const jumlahBelumDiputuskan = (detail?.materials.length || 0) - jumlahDipenuhi - jumlahTidakDipenuhi;

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

            <div className="checker-detail-section manager-material-section">
              <div className="manager-material-heading">
                <div>
                  <span className="checker-kicker">MATERIAL EVALUATION</span>
                  <h3>Evaluasi Material</h3>
                  <p>17 kolom mengikuti format evaluasi manual. Geser tabel ke samping untuk melihat PO, TAG, dan DONOR.</p>
                </div>
                <span className="manager-row-count">{detail.materials.length} Material</span>
              </div>
              <div className="manager-decision-summary" aria-label="Ringkasan keputusan pemenuhan">
                <div><span className="manager-summary-dot is-yes" />Dipenuhi <strong>{jumlahDipenuhi}</strong></div>
                <div><span className="manager-summary-dot is-no" />Tidak Dipenuhi <strong>{jumlahTidakDipenuhi}</strong></div>
                <div><span className="manager-summary-dot is-pending" />Belum Diputuskan <strong>{jumlahBelumDiputuskan}</strong></div>
              </div>
              <div className="manager-table-scroll" role="region" tabIndex={0} aria-label="Tabel evaluasi 17 kolom, dapat digeser horizontal">
                <table className="manager-evaluation-table">
                  <thead>
                    <tr>
                      <th scope="col">PLANT_NAME</th>
                      <th scope="col">MATERIAL_CODE</th>
                      <th scope="col">KETERANGAN</th>
                      <th scope="col" className="manager-numeric">BOQ</th>
                      <th scope="col" className="manager-numeric">LOT_SIZE</th>
                      <th scope="col" className="manager-numeric">MONTHLY_DEMAND</th>
                      <th scope="col" className="manager-numeric">ROP</th>
                      <th scope="col" className="manager-numeric">EOQ</th>
                      <th scope="col" className="manager-numeric">SAP_QTY <small>Snapshot</small></th>
                      <th scope="col" className="manager-numeric">PO_QTY</th>
                      <th scope="col" className="manager-numeric">PR_QTY</th>
                      <th scope="col" className="manager-numeric">TOTAL</th>
                      <th scope="col" className="manager-numeric">GAP</th>
                      <th scope="col" className="manager-decision-column">PEMENUHAN</th>
                      <th scope="col">PO</th>
                      <th scope="col">TAG</th>
                      <th scope="col">DONOR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.materials.map((item, index) => {
                      const sapQty = sapQtyByMaterial.get(normalizeMaterialCode(item.kode)) ??
                        nilaiMaterial(item, "sapQty", "sap_qty", "SAP_QTY") ??
                        getDummyStock(detail.gudang, item.kode)?.sapQty ?? null;
                      const gap = nilaiMaterial(item, "gap", "GAP");
                      const keputusan = statusPemenuhan(item);
                      return (
                        <tr key={`${item.kode}-${index}`}>
                          <td className="manager-sticky-plant">{detail.gudang || "—"}</td>
                          <td className="manager-sticky-code"><strong>{item.kode || "—"}</strong></td>
                          <td>{detail.pekerjaan || "—"}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "boqQty", "BOQ_QTY"))}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "lotSize", "lot_size", "LOT_SIZE"))}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "monthlyDemand", "monthly_demand", "MONTHLY_DEMAND"))}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "rop", "ROP"))}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "eoq", "EOQ"))}</td>
                          <td className="manager-numeric">{tampilAngka(sapQty)}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "poQty", "po_qty", "PO_QTY"))}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "prQty", "pr_qty", "PR_QTY"))}</td>
                          <td className="manager-numeric">{tampilAngka(nilaiMaterial(item, "total", "TOTAL"))}</td>
                          <td className={`manager-numeric ${gap !== null && Number(gap) < 0 ? "manager-negative-gap" : ""}`}>{tampilAngka(gap)}</td>
                          <td className="manager-decision-column">
                            <select
                              className={`manager-decision-select ${keputusan === "DIPENUHI" ? "is-yes" : keputusan === "TIDAK DIPENUHI" ? "is-no" : ""}`}
                              aria-label={`Pemenuhan material ${item.kode || index + 1}`}
                              value={keputusan}
                              onChange={(event) => updateManagerMaterial(index, "pemenuhan", event.target.value)}
                            >
                              <option value="">Pilih keputusan</option>
                              <option value="DIPENUHI">DIPENUHI</option>
                              <option value="TIDAK DIPENUHI">TIDAK DIPENUHI</option>
                            </select>
                          </td>
                          <td className="manager-edit-cell">{managerMaterialInput(item, index, "po", "PO")}</td>
                          <td className="manager-edit-cell">{managerMaterialInput(item, index, "tag", "TAG")}</td>
                          <td className="manager-edit-cell manager-donor-cell">{managerMaterialInput(item, index, "donor", "DONOR")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="manager-table-footnote">Nilai yang belum tersedia ditampilkan sebagai “—”, bukan nol. Data SAP dapat berasal dari snapshot Checker; jika belum ada, tampilan lama masih memakai data stok dummy sebagai fallback.</p>
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
