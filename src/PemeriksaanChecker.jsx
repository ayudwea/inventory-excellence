import { showMiraConfirm } from "./components/miraConfirm.js";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { supabase } from "./lib/supabase";

const alasanTolakOptions = [
  "BA Tidak Tersedia",
  "BOQ Tidak Tersedia",
  "QTY BOQ dan BA Tidak Sesuai",
  "QTY Input dan Dokumen Tidak Sesuai",
  "SPK Tidak Tersedia",
];

const dataKabelHeaders = [
  "Area",
  "Region",
  "Branch",
  "Nama WH",
  "Kode Material",
  "Haspel QTY",
  "Potongan QTY",
  "Total QTY",
];

const dataStokSapHeaders = [
  "Material",
  "Material description",
  "Material Group",
  "Plant",
  "Nama wh",
  "Branch",
  "Region",
  "Area",
  "Storage location",
  "Base Unit of Measure",
  "Unrestricted",
  "Currency",
  "In transfer (plant)",
];

const sapSummaryMaterials = [
  { code: "ADSS-12", label: "Total ADSS-12 (M)" },
  { code: "ODP-SOLID-8-L", label: "ODP-SOLID-8-L (PCS)" },
  { code: "PIGTAIL-SC", label: "PIGTAIL-SC (PCS)" },
];

function parseSapQuantity(value) {
  const normalized = String(value ?? "").trim().replace(/\s/g, "");
  if (!normalized) return 0;

  const lastSeparator = Math.max(
    normalized.lastIndexOf("."),
    normalized.lastIndexOf(",")
  );
  if (lastSeparator < 0) {
    const quantity = Number(normalized);
    return Number.isFinite(quantity) ? quantity : 0;
  }

  const decimals = normalized.length - lastSeparator - 1;
  const hasBothSeparators = normalized.includes(".") && normalized.includes(",");
  const isThousandsSeparator =
    !hasBothSeparators &&
    ((normalized.match(/[.,]/g) || []).length > 1 || decimals === 3);
  const numberString = isThousandsSeparator
    ? normalized.replace(/[.,]/g, "")
    : `${normalized.slice(0, lastSeparator).replace(/[.,]/g, "")}.${normalized
        .slice(lastSeparator + 1)
        .replace(/[.,]/g, "")}`;
  const quantity = Number(numberString);

  return Number.isFinite(quantity) ? quantity : 0;
}

async function appendCsvRows(tableName, headers, rows) {
  const records = rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
  let insertedCount = 0;

  for (let index = 0; index < records.length; index += 500) {
    const batch = records.slice(index, index + 500);
    const { error } = await supabase.from(tableName).insert(batch);
    if (error) {
      const failure = new Error(error.message);
      failure.insertedCount = insertedCount;
      throw failure;
    }
    insertedCount += batch.length;
  }

  return insertedCount;
}

function PemeriksaanChecker({ requests, onUpdateRequest, onApproved }) {
  const [checkerRequestId, setCheckerRequestId] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [dataStokModalOpen, setDataStokModalOpen] = useState(false);
  const [dataKabelModalOpen, setDataKabelModalOpen] = useState(false);
  const [pendingSnapshots, setPendingSnapshots] = useState({});
  const [dataStokSapDraft, setDataStokSapDraft] = useState(null);
  const [dataKabelDraft, setDataKabelDraft] = useState(null);
  const [submittingSnapshot, setSubmittingSnapshot] = useState("");

  const pendingRequests = requests.filter(
    (request) => request.status === "Menunggu Pemeriksaan Checker"
  );

  const checkerDetail =
    pendingRequests.find(
      (request) => request.requestId === checkerRequestId
    ) || null;
  const visibleSnapshots = checkerDetail?.snapshots || pendingSnapshots;
  const dataStokSapPreview = dataStokSapDraft || {
    file: visibleSnapshots.dataStokSap,
    headers: visibleSnapshots.dataStokSapHeaders,
    rows: visibleSnapshots.dataStokSapRows,
  };
  const dataKabelPreview = dataKabelDraft || {
    file: visibleSnapshots.dataKabelPotongan,
    rows: visibleSnapshots.dataKabelPotonganRows,
  };
  const hasSapSnapshotData = Boolean(dataStokSapPreview.headers);
  const sapSummary = useMemo(() => {
    const headers = dataStokSapPreview.headers || [];
    const rows = dataStokSapPreview.rows || [];
    const warehouseIndex = headers.indexOf("Nama wh");
    const materialIndex = headers.indexOf("Material");
    const quantityIndex = headers.indexOf("Unrestricted");
    const warehouses = new Map();

    if (warehouseIndex < 0 || materialIndex < 0 || quantityIndex < 0) {
      return [];
    }

    rows.forEach((row) => {
      const warehouse = String(row[warehouseIndex] ?? "").trim();
      const material = String(row[materialIndex] ?? "").trim().toUpperCase();
      const summaryMaterial = sapSummaryMaterials.find(
        (item) => item.code === material
      );
      if (!warehouse || !summaryMaterial) return;

      if (!warehouses.has(warehouse)) {
        warehouses.set(warehouse, new Map());
      }

      const quantities = warehouses.get(warehouse);
      quantities.set(
        summaryMaterial.code,
        (quantities.get(summaryMaterial.code) || 0) +
          parseSapQuantity(row[quantityIndex])
      );
    });

    const totals = new Map(sapSummaryMaterials.map(({ code }) => [code, 0]));
    const summaryRows = [...warehouses].map(([warehouse, quantities]) => {
      sapSummaryMaterials.forEach(({ code }) => {
        totals.set(code, totals.get(code) + (quantities.get(code) || 0));
      });
      return { warehouse, quantities };
    });

    return [
      ...summaryRows,
      { warehouse: "Total", quantities: totals },
    ];
  }, [dataStokSapPreview.headers, dataStokSapPreview.rows]);
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

    const dokumenWajib = [
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

  async function unggahDataStokSap(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      await Swal.fire({
        icon: "warning",
        title: "Format file tidak sesuai",
        text: "Data Stok SAP harus berupa file CSV.",
      });
      return;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }).map((row) => row.map((cell) => String(cell)));
      const [rawHeaders = [], ...dataRows] = rows;
      const headers = rawHeaders.map((header) =>
        String(header).replace(/^\uFEFF/, "").trim()
      );

      if (headers.length !== dataStokSapHeaders.length ||
        !dataStokSapHeaders.every((header, index) => headers[index] === header)) {
        await Swal.fire({
          icon: "warning",
          title: "Header CSV tidak sesuai",
          text: `Gunakan template dengan kolom: ${dataStokSapHeaders.join(", ")}.`,
        });
        return;
      }

      const validRows = dataRows.filter((row) =>
        row.some((value) => String(value).trim() !== "")
      );
      setDataStokSapDraft({
        file,
        headers: dataStokSapHeaders,
        rows: validRows,
      });
    } catch (error) {
      console.error("Gagal mengunggah Data Stok SAP:", error);
      await Swal.fire({
        icon: "error",
        title: "Gagal membaca Data Stok SAP",
        text: error.message,
      });
    }
  }

  async function submitDataStokSap() {
    if (!dataStokSapDraft || submittingSnapshot) return;

    setSubmittingSnapshot("sap");
    try {
      const insertedCount = await appendCsvRows(
        "Data Stock SAP",
        dataStokSapDraft.headers,
        dataStokSapDraft.rows
      );
      simpanSnapshotData({
        dataStokSap: dataStokSapDraft.file,
        dataStokSapHeaders: dataStokSapDraft.headers,
        dataStokSapRows: dataStokSapDraft.rows,
      });
      setDataStokSapDraft(null);
      await Swal.fire({
        icon: "success",
        title: "Data Stok SAP tersimpan",
        text: `${insertedCount} baris berhasil ditambahkan ke Supabase.`,
      });
    } catch (error) {
      console.error("Gagal menyimpan Data Stok SAP ke Supabase:", error);
      await Swal.fire({
        icon: "error",
        title: error.insertedCount > 0
          ? "Sebagian data Stok SAP tersimpan"
          : "Gagal mengunggah Data Stok SAP",
        text: error.insertedCount > 0
          ? `${error.insertedCount} baris telah ditambahkan sebelum gagal. ${error.message}`
          : `Periksa koneksi Supabase, nama tabel, kolom, dan izin insert. ${error.message}`,
      });
    } finally {
      setSubmittingSnapshot("");
    }
  }

  function simpanSnapshotData(snapshotUpdates) {
    if (checkerDetail) {
      onUpdateRequest(checkerDetail.requestId, {
        snapshots: {
          ...checkerDetail.snapshots,
          ...snapshotUpdates,
        },
      });
      return;
    }

    setPendingSnapshots((previous) => ({
      ...previous,
      ...snapshotUpdates,
    }));
  }

  function pilihRequest(requestId) {
    setCheckerRequestId(requestId);
    setAlasanTolak("");

    if (!requestId || Object.keys(pendingSnapshots).length === 0) return;

    const request = requests.find((item) => item.requestId === requestId);
    onUpdateRequest(requestId, {
      snapshots: {
        ...request?.snapshots,
        ...pendingSnapshots,
      },
    });
    setPendingSnapshots({});
  }

  async function unggahDataKabel(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      await Swal.fire({
        icon: "warning",
        title: "Format file tidak sesuai",
        text: "Data Kabel Potongan harus berupa file CSV.",
      });
      return;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const [rawHeaders = [], ...rawRows] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      const headers = rawHeaders.map((header) =>
        String(header).replace(/^\uFEFF/, "").trim()
      );

      if (headers.length !== dataKabelHeaders.length ||
        !dataKabelHeaders.every((header, index) => headers[index] === header)) {
        await Swal.fire({
          icon: "warning",
          title: "Header CSV tidak sesuai",
          text: `Gunakan template dengan kolom: ${dataKabelHeaders.join(", ")}.`,
        });
        return;
      }

      const rows = rawRows
        .filter((row) => row.some((value) => String(value).trim() !== ""))
        .map((row) => dataKabelHeaders.map((_, index) => String(row[index] ?? "")));

      setDataKabelDraft({
        file,
        headers: dataKabelHeaders,
        rows,
      });
    } catch (error) {
      console.error("Gagal mengunggah Data Kabel Potongan:", error);
      await Swal.fire({
        icon: "error",
        title: "Gagal membaca Data Kabel Potongan",
        text: error.message,
      });
    }
  }

  async function submitDataKabel() {
    if (!dataKabelDraft || submittingSnapshot) return;

    setSubmittingSnapshot("kabel");
    try {
      const insertedCount = await appendCsvRows(
        "Data Kabel",
        dataKabelDraft.headers,
        dataKabelDraft.rows
      );
      simpanSnapshotData({
        dataKabelPotongan: dataKabelDraft.file,
        dataKabelPotonganRows: dataKabelDraft.rows,
      });
      setDataKabelDraft(null);
      await Swal.fire({
        icon: "success",
        title: "Data Kabel tersimpan",
        text: `${insertedCount} baris berhasil ditambahkan ke Supabase.`,
      });
    } catch (error) {
      console.error("Gagal menyimpan Data Kabel Potongan ke Supabase:", error);
      await Swal.fire({
        icon: "error",
        title: error.insertedCount > 0
          ? "Sebagian Data Kabel tersimpan"
          : "Gagal mengunggah Data Kabel",
        text: error.insertedCount > 0
          ? `${error.insertedCount} baris telah ditambahkan sebelum gagal. ${error.message}`
          : `Periksa koneksi Supabase, nama tabel, kolom, dan izin insert. ${error.message}`,
      });
    } finally {
      setSubmittingSnapshot("");
    }
  }

  function unduhTemplateDataKabel() {
    const csv = `\uFEFF${dataKabelHeaders.join(",")}\r\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-data-kabel-potongan.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function unduhTemplateDataStokSap() {
    const csv = `\uFEFF${dataStokSapHeaders.join(",")}\r\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-data-stok-sap.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  async function prosesChecker(status) {
    if (!checkerDetail) return;

    if (status === "Ditolak Checker" && !alasanTolak) {
      alert("Pilih alasan penolakan terlebih dahulu.");
      return;
    }

    const label =
      status === "Disetujui Checker" ? "menyetujui" : "menolak";

    const isConfirmed = await showMiraConfirm({
      title: "Konfirmasi Pemeriksaan",
      text: `Yakin ingin ${label} ${checkerDetail.requestId}?`,
      confirmText: status === "Disetujui Checker" ? "Ya, Approve" : "Ya, Tolak",
      cancelText: "Batal",
      variant: status === "Disetujui Checker" ? "confirm" : "danger",
    });

    if (!isConfirmed) return;

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
    if (status === "Disetujui Checker") {
      onApproved?.();
    }
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
          <div className="checker-detail-section checker-snapshot-section">
            <h3>Snapshot Data</h3>
            <p className="checker-snapshot-help">
              Unggah snapshot untuk mendukung pemeriksaan. Detail pengajuan tetap dapat dilihat tanpa snapshot.
            </p>
            <div className="checker-snapshot-grid">
              <SnapshotUpload
                label="Data Stok SAP"
                file={visibleSnapshots.dataStokSap}
                onClick={() => setDataStokModalOpen(true)}
              />
              <div className="checker-snapshot-card">
                <span>
                  Data Kabel Potongan <span className="checker-snapshot-required">*</span>
                </span>
                <small>
                  {visibleSnapshots.dataKabelPotongan?.name || "Belum ada file CSV"}
                </small>
                <button
                  className="checker-snapshot-button"
                  type="button"
                  onClick={() => setDataKabelModalOpen(true)}
                >
                  {visibleSnapshots.dataKabelPotongan ? "Lihat / Ganti Data Kabel" : "Upload Data Kabel"}
                </button>
              </div>
            </div>
            {!checkerDetail && Object.keys(pendingSnapshots).length > 0 && (
              <p className="checker-snapshot-help">
                Snapshot yang diunggah sebelum memilih Request ID akan dipasangkan setelah request dipilih.
              </p>
            )}
          </div>
          <div className="field">
            <label>Request ID</label>

            <select
              value={checkerRequestId}
              onChange={(e) => pilihRequest(e.target.value)}
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
              Pilih Request ID untuk melihat detail pengajuan.
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
                className="checker-doc-grid"
              >
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

      {dataStokModalOpen && (
        <div
          className="checker-snapshot-overlay"
          onClick={() => setDataStokModalOpen(false)}
        >
          <section
            className="checker-snapshot-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-stok-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="checker-snapshot-modal-header">
              <div>
                <span>SNAPSHOT CSV</span>
                <h2 id="data-stok-title">Data Stok SAP</h2>
                <p>{checkerDetail ? `Request: ${checkerDetail.requestId}` : "Belum dipasangkan ke request"}</p>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => setDataStokModalOpen(false)}
              >
                ✕
              </button>
            </header>

            <div className="checker-snapshot-modal-actions">
              <button type="button" onClick={unduhTemplateDataStokSap}>
                Download Template CSV
              </button>
              <label className="checker-snapshot-button">
                {dataStokSapPreview.file ? "Ganti File CSV" : "Upload File CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    unggahDataStokSap(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {dataStokSapPreview.file && (
                <small>{dataStokSapPreview.file.name}</small>
              )}
              {dataStokSapDraft && (
                <button
                  type="button"
                  className="checker-snapshot-button"
                  onClick={submitDataStokSap}
                  disabled={Boolean(submittingSnapshot)}
                >
                  {submittingSnapshot === "sap" ? "Menyimpan..." : "Submit"}
                </button>
              )}
            </div>
            <p className="checker-snapshot-help">
              Upload hanya untuk preview. Klik Submit untuk mengirim data ke Supabase.
            </p>

            {hasSapSnapshotData && (
              <>
                <h3 className="checker-snapshot-preview-title">
                  Ringkasan stok berdasarkan gudang
                </h3>
                <div className="checker-snapshot-table-wrap">
                  <table className="checker-snapshot-table">
                    <thead>
                      <tr>
                        <th>Gudang</th>
                        {sapSummaryMaterials.map(({ code, label }) => (
                          <th key={code}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sapSummary.length ? (
                        sapSummary.map(({ warehouse, quantities }) => (
                          <tr
                            key={warehouse}
                            className={warehouse === "Total" ? "checker-snapshot-total-row" : undefined}
                          >
                            <td>{warehouse}</td>
                            {sapSummaryMaterials.map(({ code }) => (
                              <td key={code}>
                                {(quantities.get(code) || 0).toLocaleString("id-ID", {
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={sapSummaryMaterials.length + 1}>
                            Tidak ada data stok untuk material ADSS-12, ODP-SOLID-8-L, dan PIGTAIL-SC.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <h3 className="checker-snapshot-preview-title">Preview file CSV</h3>
                <div className="checker-snapshot-table-wrap">
                  <table className="checker-snapshot-table">
                    <thead>
                      <tr>
                        {dataStokSapPreview.headers.map((header, index) => (
                          <th key={`${header}-${index}`}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataStokSapPreview.rows.length ? (
                        dataStokSapPreview.rows.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {dataStokSapPreview.headers.map((header, columnIndex) => (
                              <td key={`${header}-${columnIndex}`}>{row[columnIndex] ?? ""}</td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={dataStokSapPreview.headers.length}>
                            CSV valid, tidak ada baris data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {dataKabelModalOpen && (
        <div
          className="checker-snapshot-overlay"
          onClick={() => setDataKabelModalOpen(false)}
        >
          <section
            className="checker-snapshot-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-kabel-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="checker-snapshot-modal-header">
              <div>
                <span>SNAPSHOT CSV</span>
                <h2 id="data-kabel-title">Data Kabel Potongan</h2>
                <p>{checkerDetail ? `Request: ${checkerDetail.requestId}` : "Belum dipasangkan ke request"}</p>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => setDataKabelModalOpen(false)}
              >
                ✕
              </button>
            </header>

            <div className="checker-snapshot-modal-actions">
              <button type="button" onClick={unduhTemplateDataKabel}>
                Download Template CSV
              </button>
              <label className="checker-snapshot-button">
                {dataKabelPreview.file ? "Ganti File CSV" : "Upload File CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    unggahDataKabel(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {dataKabelPreview.file && (
                <small>{dataKabelPreview.file.name}</small>
              )}
              {dataKabelDraft && (
                <button
                  type="button"
                  className="checker-snapshot-button"
                  onClick={submitDataKabel}
                  disabled={Boolean(submittingSnapshot)}
                >
                  {submittingSnapshot === "kabel" ? "Menyimpan..." : "Submit"}
                </button>
              )}
            </div>
            <p className="checker-snapshot-help">
              Upload hanya untuk preview. Klik Submit untuk mengirim data ke Supabase.
            </p>

            {dataKabelPreview.rows ? (
              <div className="checker-snapshot-table-wrap">
                <table className="checker-snapshot-table">
                  <thead>
                    <tr>{dataKabelHeaders.map((header) => <th key={header}>{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {dataKabelPreview.rows.length ? (
                      dataKabelPreview.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {dataKabelHeaders.map((header, columnIndex) => (
                            <td key={header}>{row[columnIndex]}</td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={dataKabelHeaders.length}>CSV valid, tidak ada baris data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="checker-snapshot-empty">
                Download template, isi datanya, lalu upload file CSV untuk melihat tabel.
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function SnapshotUpload({ label, file, onClick }) {
  return (
    <div className="checker-snapshot-card">
      <span>
        {label} <span className="checker-snapshot-required">*</span>
      </span>
      <small>{file?.name || "Belum ada file CSV"}</small>
      <button className="checker-snapshot-button" type="button" onClick={onClick}>
        {file ? "Lihat / Ganti Data Stok" : "Upload Data Stok"}
      </button>
    </div>
  );
}

function DocButton({ label, file, onClick }) {
  function downloadFile() {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={`checker-doc-card ${!file ? "doc-missing" : ""}`}>
      <span>{label}</span>
      <small>{file?.name || "Dokumen belum tersedia"}</small>
      <div className="checker-doc-actions">
        <button type="button" onClick={onClick} disabled={!file}>
          Preview
        </button>
        <button type="button" onClick={downloadFile} disabled={!file}>
          Download
        </button>
      </div>
    </div>
  );
}

export default PemeriksaanChecker;
