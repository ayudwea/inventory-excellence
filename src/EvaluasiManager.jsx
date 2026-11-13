import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
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
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("SEMUA");
  const [draftMaterials, setDraftMaterials] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [preview, setPreview] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [approvalPreview, setApprovalPreview] = useState(false);


  const waitingRequests = useMemo(
    () =>
      requests.filter(
        (request) => request.status === "Menunggu Evaluasi Manager"
      ),
    [requests]
  );

  const sourceDetail = waitingRequests.find(
    (request) => request.requestId === selectedRequestId
  ) || null;
  const detail = sourceDetail
    ? { ...sourceDetail, materials: draftMaterials ?? sourceDetail.materials }
    : null;

  function selectRequest(id) {
    if (id === selectedRequestId) return;
    if (isDirty && !window.confirm("Perubahan evaluasi belum disimpan. Pindah request dan abaikan perubahan?")) return;
    const selected = waitingRequests.find((request) => request.requestId === id);
    setSelectedRequestId(id);
    setDraftMaterials(selected ? selected.materials.map((item) => ({ ...item })) : null);
    setCatatanManager(selected?.catatanManager || "");
    setAlasanTolak("");
    setMaterialSearch("");
    setMaterialFilter("SEMUA");
    setIsDirty(false);
    setApprovalPreview(false);
    closePreview();
  }

  // Jika request diselesaikan oleh workflow lain, jangan menampilkan formulir yang sudah tidak aktif.
  useEffect(() => {
    if (!selectedRequestId || sourceDetail) return;
    setSelectedRequestId("");
    setDraftMaterials(null);
    setIsDirty(false);
  }, [selectedRequestId, sourceDetail]);


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

  function saveEvaluation() {
    if (!detail) return;
    onUpdateRequest(detail.requestId, {
      materials: detail.materials.map((item) => ({ ...item })),
      catatanManager: catatanManager.trim(),
      managerDraftSavedAt: new Date().toISOString(),
    });
    setIsDirty(false);
  }

  const decisionChecks = detail?.materials.map((item) => {
    const decision = statusPemenuhan(item);
    const po = Number(nilaiMaterial(item, "po", "PO") ?? 0);
    const tag = Number(nilaiMaterial(item, "tag", "TAG") ?? 0);
    const nonNegative = [po, tag].every((v) => Number.isFinite(v) && v >= 0);
    const valid = !!decision && nonNegative &&
      (decision !== "DIPENUHI" || po + tag > 0) &&
      (decision !== "TIDAK DIPENUHI" || po + tag === 0) &&
      (tag <= 0 || String(nilaiMaterial(item, "donor", "DONOR") || "").trim().length > 0);
    return { kode: item.kode || "Material", valid };
  }) || [];

  const incompleteChecks = decisionChecks.filter((item) => !item.valid);
  const approvalReady = detail && decisionChecks.length > 0 &&
    incompleteChecks.length === 0 && stats.mismatch === 0 &&
    stats.dokumenLengkap === stats.totalDokumenWajib;

  function prosesManager(action) {
    if (!detail) return;
    if (action === "tolak" && !alasanTolak) {
      alert("Pilih alasan penolakan terlebih dahulu.");
      return;
    }
    if (action === "approve") {
      if (!approvalReady) {
        alert("Evaluasi belum lengkap. Periksa checklist dan material yang ditandai.");
        return;
      }
      setApprovalPreview(true);
      return;
    }
    const yakin = window.confirm(`Yakin ingin menolak ${detail.requestId}?`);
    if (!yakin) return;
    finalizeManagerDecision("tolak");
  }

  function finalizeManagerDecision(action) {
    if (!detail) return;
    onUpdateRequest(detail.requestId, {
      materials: detail.materials.map((item) => ({ ...item })),
      status: action === "approve" ? "Menunggu Pemenuhan Material" : "Ditolak Manager",
      alasanTolakManager: action === "tolak" ? alasanTolak : "",
      catatanManager: catatanManager.trim(),
      managerName: "Manager",
      managerEvaluatedAt: new Date().toISOString(),
    });
    setSelectedRequestId("");
    setDraftMaterials(null);
    setIsDirty(false);
    setAlasanTolak("");
    setCatatanManager("");
    setApprovalPreview(false);
  }

  async function openPreview(file) {
    if (!file) return;
    closePreview();
    const ext = file.name?.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      setPreview({ name: file.name, type: "pdf", url: URL.createObjectURL(file) });
      return;
    }
    if (ext === "xlsx" || ext === "xls") {
      try {
        const workbook = XLSX.read(await file.arrayBuffer());
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
        setExcelRows(rows.slice(0, 150).map((row) => row.slice(0, 35)));
        setPreview({ name: file.name, type: "excel" });
      } catch (error) {
        console.error("Gagal preview Excel:", error);
        alert("Dokumen Excel tidak dapat dibaca.");
      }
    } else {
      alert("Format preview belum didukung.");
    }
  }

  function closePreview() {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setExcelRows([]);
  }

  function updateManagerMaterial(index, field, value) {
    if (!detail) return;
    setDraftMaterials((previous) =>
      (previous ?? detail.materials).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
    setIsDirty(true);
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
  const totalPO = detail?.materials.reduce((sum, item) => sum + (Number(nilaiMaterial(item, "po", "PO")) || 0), 0) || 0;
  const totalTAG = detail?.materials.reduce((sum, item) => sum + (Number(nilaiMaterial(item, "tag", "TAG")) || 0), 0) || 0;
  const displayedMaterials = detail?.materials.map((item, index) => ({ item, index })).filter(({ item }) => {
    const matchSearch = !materialSearch.trim() || [
      item.kode, item.satuan, detail.gudang, detail.pekerjaan
    ].some((value) => String(value || "").toLowerCase().includes(materialSearch.trim().toLowerCase()));
    const decision = statusPemenuhan(item);
    return matchSearch && (materialFilter === "SEMUA" || (materialFilter === "BELUM" ? !decision : decision === materialFilter));
  }) || [];

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
              onChange={(e) => selectRequest(e.target.value)}
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
              <div className="manager-table-tools">
                <input
                  type="search"
                  aria-label="Cari kode material"
                  placeholder="Cari kode material, satuan, gudang..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                />
                <select aria-label="Filter keputusan pemenuhan" value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}>
                  <option value="SEMUA">Semua keputusan</option>
                  <option value="DIPENUHI">Dipenuhi</option>
                  <option value="TIDAK DIPENUHI">Tidak Dipenuhi</option>
                  <option value="BELUM">Belum Diputuskan</option>
                </select>
                <span>{displayedMaterials.length} dari {detail.materials.length} material</span>
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
                    {displayedMaterials.map(({ item, index }) => {
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
                    {displayedMaterials.length === 0 && (
                      <tr><td colSpan={17} className="manager-no-results">Tidak ada material sesuai pencarian atau filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="manager-table-footnote">Nilai yang belum tersedia ditampilkan sebagai “—”, bukan nol. SAP QTY tetap mengutamakan snapshot Checker, dan data stok dummy masih menjadi fallback frontend. Perubahan tabel belum disimpan sampai klik “Simpan Sementara”.</p>
              <div className="manager-save-bar">
                <span>{isDirty ? "● Ada perubahan yang belum disimpan." : detail.managerDraftSavedAt ? `Tersimpan: ${formatTanggal(detail.managerDraftSavedAt)}` : "Belum ada perubahan evaluasi."}</span>
                <button type="button" onClick={saveEvaluation} disabled={!isDirty}>Simpan Evaluasi Sementara</button>
              </div>
            </div>

            <div className="checker-detail-section manager-documents-section">
              <div className="checker-note-title"><h3>Dokumen Pendukung</h3><span>Preview tanpa meninggalkan evaluasi</span></div>
              <div className="manager-document-list">
                {["spk", "boq", "ba"].map((key) => {
                  const file = detail.files?.[key];
                  return (
                    <button key={key} type="button" disabled={!file} onClick={() => openPreview(file)}>
                      <strong>{key.toUpperCase()}</strong>
                      <span>{file?.name || "Belum tersedia"}</span>
                      <b>{file ? "Lihat Dokumen" : "Tidak ada file"}</b>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="checker-detail-section manager-validation">
              <div className="checker-note-title"><h3>Checklist Sebelum Approve</h3><span>{approvalReady ? "Evaluasi lengkap" : "Lengkapi sebelum persetujuan"}</span></div>
              <div className="manager-validation-grid">
                <p className={stats.mismatch === 0 ? "passed" : "failed"}>{stats.mismatch === 0 ? "✓" : "!"} QTY BA dan BOQ sesuai</p>
                <p className={stats.dokumenLengkap === stats.totalDokumenWajib ? "passed" : "failed"}>{stats.dokumenLengkap === stats.totalDokumenWajib ? "✓" : "!"} Dokumen wajib tersedia</p>
                <p className={jumlahBelumDiputuskan === 0 ? "passed" : "failed"}>{jumlahBelumDiputuskan === 0 ? "✓" : "!"} Seluruh material punya keputusan</p>
                <p className={incompleteChecks.length === 0 ? "passed" : "failed"}>{incompleteChecks.length === 0 ? "✓" : "!"} PO/TAG dan DONOR sesuai keputusan</p>
              </div>
              {incompleteChecks.length > 0 && (
                <p className="manager-validation-note">Material perlu diperiksa: {incompleteChecks.slice(0, 8).map((entry) => entry.kode).join(", ")}{incompleteChecks.length > 8 ? ` dan ${incompleteChecks.length - 8} lainnya` : ""}.</p>
              )}
              <p className="manager-validation-help">Untuk DIPENUHI, isi PO atau TAG lebih dari 0; jika TAG digunakan, DONOR wajib diisi. Untuk TIDAK DIPENUHI, PO dan TAG harus 0/kosong.</p>
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
                    onChange={(e) => { setCatatanManager(e.target.value); setIsDirty(true); }}
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
                  disabled={!approvalReady}
                  title={!approvalReady ? "Lengkapi checklist evaluasi sebelum Approve" : "Lihat ringkasan sebelum menyetujui"}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {preview && (
        <div className="preview-overlay" onClick={closePreview} role="presentation">
          <div className="preview-modal manager-preview-modal" role="dialog" aria-modal="true" aria-label="Preview dokumen" onClick={(event) => event.stopPropagation()}>
            <div className="preview-header">
              <div><h3>Preview Dokumen</h3><p>{preview.name}</p></div>
              <button type="button" className="preview-close" onClick={closePreview}>✕</button>
            </div>
            <div className="preview-content">
              {preview.type === "pdf" ? (
                <iframe src={preview.url} className="preview-frame" title={preview.name} />
              ) : (
                <div className="excel-preview">
                  <table><tbody>{excelRows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{String(cell)}</td>)}</tr>
                  ))}</tbody></table>
                  <p>Preview dibatasi hingga 150 baris dan 35 kolom pertama.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {approvalPreview && detail && (
        <div className="detail-overlay" onClick={() => setApprovalPreview(false)} role="presentation">
          <div className="detail-modal manager-confirm-modal" role="dialog" aria-modal="true" aria-label="Konfirmasi persetujuan manager" onClick={(event) => event.stopPropagation()}>
            <div className="detail-header">
              <div><span className="detail-kicker">RINGKASAN SEBELUM APPROVE</span><h2>{detail.requestId}</h2><p>{detail.gudang} · {detail.pekerjaan}</p></div>
              <button type="button" className="detail-close" onClick={() => setApprovalPreview(false)}>✕</button>
            </div>
            <div className="manager-approval-summary">
              <div><span>Jumlah Material</span><strong>{detail.materials.length}</strong></div>
              <div><span>Dipenuhi</span><strong>{jumlahDipenuhi}</strong></div>
              <div><span>Tidak Dipenuhi</span><strong>{jumlahTidakDipenuhi}</strong></div>
              <div><span>Total PO</span><strong>{tampilAngka(totalPO)}</strong></div>
              <div><span>Total TAG</span><strong>{tampilAngka(totalTAG)}</strong></div>
            </div>
            <p className="manager-confirm-note">Pastikan QTY PO dan TAG sesuai kebutuhan. Dengan menyetujui, evaluasi dan status request akan disimpan bersama.</p>
            <div className="detail-footer">
              <button type="button" onClick={() => setApprovalPreview(false)}>Periksa Lagi</button>
              <button type="button" className="manager-confirm-approve" onClick={() => { if (approvalReady) finalizeManagerDecision("approve"); }}>Konfirmasi Approve</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EvaluasiManager;
