import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

const alasanTolakOptions = [
  "BA Tidak Tersedia",
  "BOQ Tidak Tersedia",
  "QTY BOQ dan BA Tidak Sesuai",
  "QTY Input dan Dokumen Tidak Sesuai",
  "SPK Tidak Tersedia",
];

function PemeriksaanChecker({ requests, onUpdateRequest }) {
  const [checkerRequestId, setCheckerRequestId] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);

  const pendingRequests = requests.filter(
    (request) => request.status === "Menunggu Pemeriksaan Checker"
  );

  const checkerDetail =
    pendingRequests.find(
      (request) => request.requestId === checkerRequestId
    ) || null;

  const detailStats = useMemo(() => {
    if (!checkerDetail) {
      return {
        totalMaterial: 0,
        mismatch: 0,
        dokumenLengkap: 0,
        totalDokumenWajib: 0,
      };
    }

    const mismatch = checkerDetail.materials.filter((item) => {
      const ba = Number(item.baQty || 0);
      const boq = Number(item.boqQty || 0);
      return ba !== boq;
    }).length;

    const dokumenWajib =
      checkerDetail.jenisPermintaan === "RECURRING"
        ? [checkerDetail.files?.ba]
        : [
            checkerDetail.files?.spk,
            checkerDetail.files?.boq,
            checkerDetail.files?.ba,
          ];

    return {
      totalMaterial: checkerDetail.materials.length,
      mismatch,
      dokumenLengkap: dokumenWajib.filter(Boolean).length,
      totalDokumenWajib: dokumenWajib.length,
    };
  }, [checkerDetail]);

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
      } catch (err) {
        console.error(err);
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

  function formatTanggal(dateString) {
    if (!dateString) return "-";

    const date = new Date(`${dateString}T00:00:00`);

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function prosesChecker(status) {
    if (!checkerDetail) return;

    if (status === "Ditolak Checker" && !alasanTolak) {
      alert("Pilih alasan penolakan terlebih dahulu.");
      return;
    }

    const label =
      status === "Disetujui Checker" ? "menyetujui" : "menolak";

    const yakin = window.confirm(
      `Yakin ingin ${label} ${checkerDetail.requestId}?`
    );

    if (!yakin) return;

    onUpdateRequest(checkerDetail.requestId, {
      status:
        status === "Disetujui Checker"
          ? "Menunggu Evaluasi Manager"
          : "Ditolak Checker",
      catatanChecker:
        status === "Ditolak Checker" ? alasanTolak : "",
      checkedAt: new Date().toISOString(),
      checkerName: "Administrator",
    });

    setCheckerRequestId("");
    setAlasanTolak("");
  }

  return (
    <>
      <section className="checker-card checker-workspace">
        <div className="checker-intro compact">
          <div>
            <span className="checker-kicker">PEMERIKSAAN PENGAJUAN</span>
            <h2>Pilih Pengajuan Material</h2>
            <p>
              Pilih Request ID yang masih menunggu pemeriksaan checker.
            </p>
          </div>

          <div className="checker-pending-badge">
            {pendingRequests.length} Menunggu
          </div>
        </div>

        <div className="checker-picker">
          <div className="field">
            <label>Request ID</label>

            <select
              value={checkerRequestId}
              onChange={(e) => {
                setCheckerRequestId(e.target.value);
                setAlasanTolak("");
              }}
            >
              <option value="">Pilih Request ID</option>

              {pendingRequests.map((request) => (
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

        {!checkerDetail ? (
          <div className="checker-empty compact-empty">
            <div className="checker-empty-icon">⌕</div>
            <strong>Pilih pengajuan yang akan diperiksa</strong>
            <span>
              Detail pengajuan akan langsung tampil setelah Request ID dipilih.
            </span>
          </div>
        ) : (
          <div className="checker-inline-detail">
            <div className="checker-inline-header">
              <div>
                <span className="checker-kicker">DETAIL PENGAJUAN</span>
                <h3>{checkerDetail.requestId}</h3>
                <p>
                  {checkerDetail.jenisPermintaan} • {checkerDetail.gudang} •{" "}
                  {checkerDetail.pekerjaan}
                </p>
              </div>

              <span className="checker-inline-status">
                {checkerDetail.status}
              </span>
            </div>

            <div className="checker-summary-grid">
              <div className="checker-summary-card">
                <span>Tanggal Input</span>
                <strong>{formatTanggal(checkerDetail.tanggalInput)}</strong>
              </div>

              <div className="checker-summary-card">
                <span>Total Material</span>
                <strong>{detailStats.totalMaterial} item</strong>
              </div>

              <div className="checker-summary-card">
                <span>Dokumen</span>
                <strong
                  className={
                    detailStats.dokumenLengkap ===
                    detailStats.totalDokumenWajib
                      ? "summary-good"
                      : "summary-bad"
                  }
                >
                  {detailStats.dokumenLengkap}/
                  {detailStats.totalDokumenWajib}{" "}
                  {detailStats.dokumenLengkap ===
                  detailStats.totalDokumenWajib
                    ? "Lengkap"
                    : "Belum Lengkap"}
                </strong>
              </div>

              <div className="checker-summary-card">
                <span>Mismatch BA / BOQ</span>
                <strong
                  className={
                    detailStats.mismatch === 0
                      ? "summary-good"
                      : "summary-bad"
                  }
                >
                  {detailStats.mismatch} material
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
                </div>

                {checkerDetail.materials.map((item, index) => {
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
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="checker-detail-section">
              <h3>Dokumen Pendukung</h3>

              <div
                className={`checker-doc-grid ${
                  checkerDetail.jenisPermintaan === "RECURRING"
                    ? "single-doc"
                    : ""
                }`}
              >
                {checkerDetail.jenisPermintaan === "KONSTRUKSI" && (
                  <>
                    <DocButton
                      label="SPK"
                      file={checkerDetail.files?.spk}
                      onClick={() => bukaPreview(checkerDetail.files?.spk)}
                    />

                    <DocButton
                      label="BOQ"
                      file={checkerDetail.files?.boq}
                      onClick={() => bukaPreview(checkerDetail.files?.boq)}
                    />
                  </>
                )}

                <DocButton
                  label="BA"
                  file={checkerDetail.files?.ba}
                  onClick={() => bukaPreview(checkerDetail.files?.ba)}
                />
              </div>
            </div>

            <div className="checker-decision-row">
              <div className="checker-reason-field">
                <div className="checker-note-title">
                  <h3>Alasan Ditolak</h3>
                  <span>* wajib jika pengajuan ditolak</span>
                </div>

                <select
                  className="checker-reject-reason"
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                >
                  <option value="">Pilih alasan penolakan</option>

                  {alasanTolakOptions.map((alasan) => (
                    <option key={alasan} value={alasan}>
                      {alasan}
                    </option>
                  ))}
                </select>
              </div>

              <div className="checker-inline-actions">
                <button
                  type="button"
                  className="checker-reject-btn"
                  onClick={() => prosesChecker("Ditolak Checker")}
                >
                  Tolak
                </button>

                <button
                  type="button"
                  className="checker-approve-btn"
                  onClick={() => prosesChecker("Disetujui Checker")}
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

export default PemeriksaanChecker;
