import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./EvaluasiManager.css";

const alasanTolakManagerOptions = [
  "Data Pengajuan Belum Sesuai",
  "Dokumen Pendukung Belum Memadai",
  "Perlu Klarifikasi Lebih Lanjut",
  "QTY Pengajuan Belum Disetujui",
  "Pengajuan Belum Dapat Diproses",
];

function EvaluasiManager({ requests, onUpdateRequest }) {
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [catatanManager, setCatatanManager] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);

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

  async function bukaPreview(file) {
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      setExcelPreview([]);
      setPreviewFile({
        type: "pdf",
        file,
        url: URL.createObjectURL(file),
      });
      return;
    }

    if (ext === "xls" || ext === "xlsx") {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });

        setExcelPreview(rows);
        setPreviewFile({
          type: "excel",
          file,
          url: null,
        });
      } catch (error) {
        console.error(error);
        alert("File Excel gagal dibaca.");
      }
    }
  }

  function tutupPreview() {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }

    setPreviewFile(null);
    setExcelPreview([]);
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
                  <div>BA QTY</div>
                  <div>BOQ QTY</div>
                  <div>Selisih</div>
                  <div>Status</div>
                  <div>Pemenuhan</div>
                  <div>PO</div>
                  <div>TAG</div>
                  <div>Donor</div>
                </div>

                {detail.materials.map((item, index) => {
                  const ba = Number(item.baQty || 0);
                  const boq = Number(item.boqQty || 0);
                  const selisih = ba - boq;
                  const sesuai = selisih === 0;

                  return (
                    <div
                      className={`checker-material-grid checker-material-row ${
                        sesuai ? "" : "checker-row-warning"
                      }`}
                      key={`${item.kode}-${index}`}
                    >
                      <div>{index + 1}</div>
                      <div>{item.kode || "-"}</div>
                      <div>{item.satuan || "-"}</div>
                      <div>{ba}</div>
                      <div>{boq}</div>

                      <div
                        className={
                          sesuai
                            ? "checker-match"
                            : "checker-difference"
                        }
                      >
                        {selisih > 0 ? `+${selisih}` : selisih}
                      </div>

                      <div>
                        <span
                          className={`material-check-status ${
                            sesuai ? "ok" : "warning"
                          }`}
                        >
                          {sesuai ? "✓ Sesuai" : "⚠ Tidak Sesuai"}
                        </span>
                      </div>

                      <div className="manager-value-cell">
                        {item.pemenuhan ?? item.PEMENUHAN ?? "-"}
                      </div>

                      <div className="manager-value-cell">
                        {item.po ?? item.PO ?? "-"}
                      </div>

                      <div className="manager-value-cell">
                        {item.tag ?? item.TAG ?? "-"}
                      </div>

                      <div className="manager-donor-cell">
                        {item.donor ?? item.DONOR ?? "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="checker-detail-section">
              <h3>Dokumen Pendukung</h3>

              <div
                className={`checker-doc-grid ${
                  detail.jenisPermintaan === "RECURRING"
                    ? "single-doc"
                    : ""
                }`}
              >
                {detail.jenisPermintaan === "KONSTRUKSI" && (
                  <>
                    <DocButton
                      label="SPK"
                      file={detail.files?.spk}
                      onClick={() => bukaPreview(detail.files?.spk)}
                    />

                    <DocButton
                      label="BOQ"
                      file={detail.files?.boq}
                      onClick={() => bukaPreview(detail.files?.boq)}
                    />
                  </>
                )}

                <DocButton
                  label="BA"
                  file={detail.files?.ba}
                  onClick={() => bukaPreview(detail.files?.ba)}
                />
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

      {previewFile && (
        <div className="preview-overlay" onClick={tutupPreview}>
          <div
            className="preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-header">
              <div>
                <h3>Preview Dokumen</h3>
                <p>{previewFile.file.name}</p>
              </div>

              <button
                type="button"
                className="preview-close"
                onClick={tutupPreview}
              >
                ✕
              </button>
            </div>

            <div className="preview-content">
              {previewFile.type === "pdf" && (
                <iframe
                  src={previewFile.url}
                  title="Preview PDF"
                  className="preview-frame"
                />
              )}

              {previewFile.type === "excel" && (
                <div className="excel-preview">
                  <table>
                    <tbody>
                      {excelPreview.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocButton({ label, file, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!file}
      className={!file ? "doc-missing" : ""}
    >
      <span>{label}</span>
      <small>{file?.name || "Dokumen belum tersedia"}</small>
      <b>{file ? "Preview Dokumen" : "Tidak tersedia"}</b>
    </button>
  );
}

export default EvaluasiManager;
