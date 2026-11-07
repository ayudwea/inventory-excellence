import { useState } from "react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import "./PengajuanMaterial.css";

const pekerjaanKonstruksi = [
  "JPP",
  "PT 3",
  "PT 2",
  "PT 4",
  "CNOP/ Node B",
  "HEM",
  "OLO",
  "MTEL",
  "MyRep",
  "Surge",
];

const pekerjaanRecurring = ["QE AKSES", "QE RECOVERY", "QE OLO"];

const tipeOptions = ["KONSTRUKSI", "RECURRING"];
const MAX_FILE_SIZE = 1024 * 1024;

const sampleGudang = [
  "BENGKULU",
  "PALEMBANG",
  "MEDAN",
  "PADANG",
  "PEKANBARU",
];

const sampleMaterial = [
  { kode: "ADSS-12", satuan: "M" },
  { kode: "ODP-SOLID-8-L", satuan: "PCS" },
  { kode: "PIGTAIL-SC", satuan: "PCS" },
];

function PengajuanMaterial({ onCreateRequest, requests = [], onUpdateRequest }) {
  const [jenisPermintaan, setJenisPermintaan] = useState(""); // backward-compatible: tipe Konstruksi / Recurring
  const [jenisPengajuan, setJenisPengajuan] = useState(""); // Baru / Pengganti
  const [noReqDiganti, setNoReqDiganti] = useState("");
  const [gudang, setGudang] = useState("");
  const [pekerjaan, setPekerjaan] = useState("");

  const [materials, setMaterials] = useState([
    { kode: "", satuan: "", baQty: "", boqQty: "" },
  ]);

  const [files, setFiles] = useState({
    spk: null,
    boq: null,
    ba: null,
  });

  const [previewFile, setPreviewFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);
  const [successModal, setSuccessModal] = useState(null);
  const [submittedDetail, setSubmittedDetail] = useState(null);

  const pekerjaanOptions =
    jenisPermintaan === "KONSTRUKSI"
      ? pekerjaanKonstruksi
      : jenisPermintaan === "RECURRING"
      ? pekerjaanRecurring
      : [];

  const requestSudahDiganti = new Set(
    requests.map((r) => r.noReqDiganti).filter(Boolean)
  );
  const daftarRequestBelumPR = requests.filter((r) => {
    const prStatus = String(r.statusPR ?? r.prStatus ?? "Belum PR").trim().toLowerCase();
    const belumPR = ["belum pr", "belum dibuat", "belum dibuat pr"].includes(prStatus);
    const tidakAdaNomorPR = !(r.noPR || r.nomorPR);
    return belumPR && tidakAdaNomorPR && !requestSudahDiganti.has(r.requestId)
      && r.status !== "Diganti" && r.status !== "Ditolak Checker"
      && r.status !== "Ditolak Manager";
  });

  const requestLama = requests.find((r) => r.requestId === noReqDiganti);
  function formatTanggalRingkas(value) {
    if (!value) return "-";
    const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", {
      day: "2-digit", month: "short", year: "numeric"
    }).format(date);
  }
  function formatUkuranFile(size) {
    return `${(size / 1024).toLocaleString("id-ID", { maximumFractionDigits: 0 })} KB`;
  }

  const kodeTerpilih = materials.map((m) => m.kode).filter(Boolean);
  const tidakDuplikat = new Set(kodeTerpilih).size === kodeTerpilih.length;
  const qtyValid = materials.length > 0 && materials.every((m) =>
    m.kode && m.baQty !== "" && m.boqQty !== "" &&
    Number.isFinite(Number(m.baQty)) && Number.isFinite(Number(m.boqQty)) &&
    Number(m.baQty) > 0 && Number(m.boqQty) > 0 &&
    Number(m.baQty) === Number(m.boqQty)
  );
  const dokumenLengkap = ["spk", "boq", "ba"].every((key) => {
    const file = files[key];
    if (!file || file.size > MAX_FILE_SIZE) return false;
    const ext = file.name.split(".").pop()?.toLowerCase();
    return key === "boq" ? ["xls", "xlsx"].includes(ext) : ext === "pdf";
  });
  const requestPenggantiValid = jenisPengajuan === "BARU" ||
    (jenisPengajuan === "PENGGANTI" && !!noReqDiganti &&
      daftarRequestBelumPR.some((r) => r.requestId === noReqDiganti));
  const canSubmit = !!jenisPermintaan && !!jenisPengajuan && !!gudang &&
    !!pekerjaan && requestPenggantiValid && tidakDuplikat && qtyValid && dokumenLengkap;
  const mismatchRows = materials.filter((m) =>
    m.baQty !== "" && m.boqQty !== "" &&
    Number(m.baQty) !== Number(m.boqQty)
  ).length;

  function tambahMaterial() {
    setMaterials((prev) => [
      ...prev,
      { kode: "", satuan: "", baQty: "", boqQty: "" },
    ]);
  }

  function hapusMaterial(index) {
    if (materials.length === 1) return;
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMaterial(index, field, value) {
    if (
      field === "kode" &&
      value &&
      materialSudahDipilihDiBarisLain(value, index)
    ) {
      Swal.fire({
        icon: "warning",
        title: "Material sudah dipilih",
        text: "Kode material ini sudah digunakan pada baris lain.",
      });
      return;
    }

    setMaterials((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        if (field === "kode") {
          const master = sampleMaterial.find((m) => m.kode === value);

          return {
            ...item,
            kode: value,
            satuan: master?.satuan || "",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function handleFileChange(key, file) {
    if (!file) {
      setFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();

    if ((key === "spk" || key === "ba") && ext !== "pdf") {
      alert(`${key.toUpperCase()} wajib berupa PDF.`);
      return;
    }

    if (key === "boq" && !["xls", "xlsx"].includes(ext)) {
      alert("BOQ wajib berupa file Excel (.xls / .xlsx).");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      Swal.fire({
        icon: "warning",
        title: "Ukuran file terlalu besar",
        text: `${key.toUpperCase()} maksimal 1 MB per file.`,
      });
      setFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }

    setFiles((prev) => ({ ...prev, [key]: file }));
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

  function generateRequestId() {
    const now = new Date();

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}${mm}${dd}`;

    const storageKey = `mira_request_counter_${dateKey}`;
    const lastNumber = Number(localStorage.getItem(storageKey) || 0);
    const nextNumber = lastNumber + 1;

    localStorage.setItem(storageKey, String(nextNumber));

    return `REQ-${dateKey}-${String(nextNumber).padStart(3, "0")}`;
  }

  function materialSudahDipilihDiBarisLain(kodeMaterial, rowIndex) {
    return materials.some(
      (item, index) =>
        index !== rowIndex &&
        item.kode === kodeMaterial
    );
  }

  function resetForm() {
    setJenisPermintaan("");
    setJenisPengajuan("");
    setNoReqDiganti("");
    setGudang("");
    setPekerjaan("");
    setMaterials([
      { kode: "", satuan: "", baQty: "", boqQty: "" },
    ]);
    setFiles({
      spk: null,
      boq: null,
      ba: null,
    });
    setPreviewFile(null);
    setExcelPreview([]);
  }

  function resetDependentSections() {
    setJenisPengajuan("");
    setNoReqDiganti("");
    setGudang("");
    setPekerjaan("");
    setMaterials([
      { kode: "", satuan: "", baQty: "", boqQty: "" },
    ]);
    setFiles({
      spk: null,
      boq: null,
      ba: null,
    });
    setPreviewFile(null);
    setExcelPreview([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) {
      alert("Pengajuan belum lengkap atau QTY BA dan QTY BOQ tidak sesuai. Periksa seluruh data dan dokumen (maksimal 1 MB).");
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Konfirmasi Pengajuan",
      text: "Pastikan data material dan dokumen sudah benar. Lanjut submit pengajuan?",
      showCancelButton: true,
      confirmButtonText: "Ya, Submit",
      cancelButtonText: "Periksa Lagi",
      confirmButtonColor: "#5c0b12",
      cancelButtonColor: "#8f7f82",
      reverseButtons: true,
    });

    if (!isConfirmed) return;

    const requestId = generateRequestId();
    const now = new Date();

    const tanggalInput = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const payload = {
      requestId,
      tanggalInput,
      jenisPermintaan,
      tipePermintaan: jenisPermintaan,
      jenisPengajuan,
      noReqDiganti: jenisPengajuan === "PENGGANTI" ? noReqDiganti : "",
      statusPR: "Belum PR",
      gudang,
      pekerjaan,
      materials: materials.map((item) => ({ ...item })),
      files: { ...files },
      status: "Menunggu Pemeriksaan Checker",
      catatanChecker: "",
    };

    onCreateRequest(payload);
    if (jenisPengajuan === "PENGGANTI" && onUpdateRequest) {
      onUpdateRequest(noReqDiganti, {
        status: "Diganti",
        digantiOleh: requestId,
      });
    }

    setSuccessModal({
      ...payload,
      totalMaterial: materials.length,
    });

    resetForm();
  }

  return (
    <>
      <form className="project-card pengajuan-refined" onSubmit={handleSubmit}>
        <section className="pengajuan-info">
          <div className="pengajuan-section-heading">
            
            <div><span className="pengajuan-eyebrow">FORM REQUEST</span><h2>Informasi Pengajuan</h2><p>Lengkapi detail permintaan dan tujuan material.</p></div>
          </div>
          <div className="pengajuan-row pengajuan-three-cols">
            <div className="field">
              <label>Tipe Permintaan <span>*</span></label>
              <select value={jenisPermintaan} onChange={(e) => {
                const nextValue = e.target.value;
                setJenisPermintaan(nextValue);
                if (nextValue !== jenisPermintaan) {
                  resetDependentSections();
                }
              }}>
                <option value="">Pilih tipe permintaan</option>
                {tipeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Jenis Permintaan <span>*</span></label>
              <select value={jenisPengajuan} onChange={(e) => {
                setJenisPengajuan(e.target.value);
                setNoReqDiganti("");
              }}>
                <option value="">Pilih jenis permintaan</option>
                <option value="BARU">Baru</option>
                <option value="PENGGANTI">Pengganti</option>
              </select>
            </div>
            <div className="field">
              <label>No. Req Diganti {jenisPengajuan === "PENGGANTI" && <span>*</span>}</label>
              <select disabled={jenisPengajuan !== "PENGGANTI"} value={noReqDiganti}
                onChange={(e) => setNoReqDiganti(e.target.value)}>
                <option value="">{jenisPengajuan === "PENGGANTI" ? "Pilih No. Req belum PR" : "Tidak diperlukan"}</option>
                {daftarRequestBelumPR.map((r) => (
                  <option key={r.requestId} value={r.requestId}>
                    {r.requestId} | {r.gudang} | {r.pekerjaan}
                  </option>
                ))}
              </select>
              {jenisPengajuan === "PENGGANTI" && (
                <small className="pengajuan-helper">Hanya request belum PR dan belum pernah diganti.</small>
              )}
            </div>
          </div>
          {jenisPengajuan === "PENGGANTI" && noReqDiganti && requestLama && (
            <div className="pengajuan-old-request">
              <div className="pengajuan-old-request-title">
                <div className="pengajuan-reference-label">
                  <span className="pengajuan-reference-icon">↗</span>
                  <div>
                    <span>REFERENSI PENGAJUAN</span>
                    <strong>{requestLama?.requestId || "Belum memilih Request ID"}</strong>
                  </div>
                </div>
                {requestLama && (
                  <span className="pengajuan-pr-chip">● {requestLama.statusPR || requestLama.prStatus || "Belum PR"}</span>
                )}
              </div>
              {requestLama ? (
                <>
                  <div className="pengajuan-reference-meta">
                    <div><small>GUDANG</small><strong>{requestLama.gudang || "-"}</strong></div>
                    <div><small>PEKERJAAN</small><strong>{requestLama.pekerjaan || "-"}</strong></div>
                    <div><small>JUMLAH MATERIAL</small><strong>{requestLama.materials?.length || 0} item</strong></div>
                  </div>
                  <div className="pengajuan-reference-footer">
                    <span>◷ {formatTanggalRingkas(requestLama.tanggalInput)}</span>
                    <span>Status: <strong>{requestLama.status || "-"}</strong></span>
                  </div>
                </>
              ) : (
                <p className="pengajuan-old-request-empty">Pilih No. Req Diganti untuk melihat ringkasan pengajuan sebelumnya.</p>
              )}
            </div>
          )}
          <div className="pengajuan-row pengajuan-two-cols">
            <div className="field">
              <label>Gudang Tujuan <span>*</span></label>
              <select value={gudang} onChange={(e) => setGudang(e.target.value)}>
                <option value="">Pilih gudang tujuan</option>
                {sampleGudang.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Nama Pekerjaan <span>*</span></label>
              <select value={pekerjaan} onChange={(e) => setPekerjaan(e.target.value)}
                disabled={!jenisPermintaan}>
                <option value="">{jenisPermintaan ? "Pilih nama pekerjaan" : "Pilih tipe permintaan terlebih dahulu"}</option>
                {pekerjaanOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
        </section>

        <div className="divider" />

        <section>
          <div className="section-header pengajuan-section-header">
            <div className="pengajuan-section-heading">
              
              <div><span className="pengajuan-eyebrow">MATERIAL REQUEST</span>
              <h2>Daftar Material</h2>
              <p>Tambahkan material yang dibutuhkan untuk proyek ini.</p></div>
            </div>

            <button
              className="secondary-btn"
              type="button"
              onClick={tambahMaterial}
            >
              ＋ Tambah Material
            </button>
          </div>

              <div className="material-table">
                <div className="material-head material-grid">
                  <div>No</div>
                  <div>KODE MATERIAL</div>
                  <div>SATUAN</div>
                  <div>BA QTY</div>
                  <div>BOQ QTY</div>
                  <div>VALIDASI</div>
                  <div>AKSI</div>
                </div>

                {materials.map((item, index) => (
                  <div className={`material-row material-grid ${item.baQty !== "" && item.boqQty !== "" && Number(item.baQty) !== Number(item.boqQty) ? "pengajuan-qty-mismatch" : ""}`} key={index}>
                    <div className="row-number">{index + 1}</div>

                    <select
                      value={item.kode}
                      onChange={(e) =>                    updateMaterial(index, "kode", e.target.value)
                  }
                >
                  <option value="">Pilih kode material</option>

                  {sampleMaterial.filter((material) =>
                    !materialSudahDipilihDiBarisLain(material.kode, index)
                  ).map((material) => (
                    <option
                      key={material.kode}
                      value={material.kode}

                    >
                      {material.kode}
                    </option>
                  ))}
                </select>

                <input
                  value={item.satuan}
                  readOnly
                  placeholder="-"
                />

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.baQty}
                  onChange={(e) =>
                    updateMaterial(index, "baQty", e.target.value)
                  }
                  placeholder="0"
                />

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.boqQty}
                  onChange={(e) =>
                    updateMaterial(index, "boqQty", e.target.value)
                  }
                  placeholder="0"
                />

                <div className="pengajuan-validation-cell">
                  {!item.kode || item.baQty === "" || item.boqQty === "" || Number(item.baQty) <= 0 || Number(item.boqQty) <= 0 ? (
                    <span className="pengajuan-status-pill waiting">Belum lengkap</span>
                  ) : Number(item.baQty) === Number(item.boqQty) ? (
                    <span className="pengajuan-status-pill matching">✓ Sesuai</span>
                  ) : (
                    <span className="pengajuan-status-pill mismatch">! Tidak sesuai</span>
                  )}
                </div>

                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => hapusMaterial(index)}
                  disabled={materials.length === 1}
                  title="Hapus material"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          {mismatchRows > 0 && (
            <div className="pengajuan-warning" role="alert">
              ⚠ {mismatchRows} material memiliki QTY BA dan QTY BOQ berbeda. Samakan QTY agar bisa submit.
            </div>
          )}
        </section>

        <div className="divider" />

        <section>
          <div className="section-header documents-title pengajuan-section-header">
            <div className="pengajuan-section-heading">
              
              <div><span className="pengajuan-eyebrow">DOCUMENT VERIFICATION</span>
              <h2>Dokumen Pendukung</h2>
              <p>SPK, BOQ, dan BA wajib untuk semua tipe permintaan, maksimal 1 MB per file.</p></div>
            </div>
          </div>

          <div className="document-grid">
            <UploadBox
              label="SPK"
              file={files.spk}
              accept=".pdf"
              description="PDF • Maks. 1 MB"
              required={true}
              onChange={(file) => handleFileChange("spk", file)}
              onPreview={() => bukaPreview(files.spk)}
            />

            <UploadBox
              label="BOQ"
              file={files.boq}
              accept=".xls,.xlsx"
              description="XLS / XLSX • Maks. 1 MB"
              required={true}
              onChange={(file) => handleFileChange("boq", file)}
              onPreview={() => bukaPreview(files.boq)}
            />

            <UploadBox
              label="BA"
              file={files.ba}
              accept=".pdf"
              description="PDF • Maks. 1 MB"
              required={true}
              onChange={(file) => handleFileChange("ba", file)}
              onPreview={() => bukaPreview(files.ba)}
            />
          </div>
        </section>

        <button className="submit-btn" type="submit" disabled={!canSubmit}>
          SUBMIT PERMINTAAN MATERIAL
          <span>→</span>
        </button>
        {!canSubmit && (
          <div className="pengajuan-submit-hint" role="status">
            Lengkapi data wajib, samakan QTY BA dan QTY BOQ, serta unggah SPK, BOQ, dan BA (maks. 1 MB).
          </div>
        )}
      </form>

      {successModal && (
        <div className="success-overlay">
          <div className="success-modal">
            <div className="success-check">✓</div>
            <h2>Pengajuan Berhasil Disimpan</h2>

            <div className="success-label">Request ID</div>
            <div className="success-request-id">
              {successModal.requestId}
            </div>

            <div className="success-summary">
              <strong>
                {successModal.jenisPermintaan} • {successModal.jenisPengajuan} • {successModal.gudang} •{" "}
                {successModal.pekerjaan}
              </strong>
              <span>
                {successModal.totalMaterial} material berhasil diajukan
              </span>
            </div>

            <div className="success-actions">
              <button
                type="button"
                className="success-view-btn"
                onClick={() => {
                  setSubmittedDetail(successModal);
                  setSuccessModal(null);
                }}
              >
                Lihat Pengajuan
              </button>

              <button
                type="button"
                className="success-close-btn"
                onClick={() => setSuccessModal(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {submittedDetail && (
        <div
          className="detail-overlay"
          onClick={() => setSubmittedDetail(null)}
        >
          <div
            className="detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detail-header">
              <div>
                <span className="detail-kicker">DETAIL PENGAJUAN</span>
                <h2>{submittedDetail.requestId}</h2>
                <p>
                  {submittedDetail.jenisPermintaan} • {submittedDetail.jenisPengajuan} • {submittedDetail.gudang} •{" "}
                  {submittedDetail.pekerjaan}
                </p>
              </div>

              <button
                type="button"
                className="detail-close"
                onClick={() => setSubmittedDetail(null)}
              >
                ✕
              </button>
            </div>

            <div className="detail-body">
              <div className="detail-status">
                <span>Status</span>
                <strong>{submittedDetail.status}</strong>
              </div>

              <div className="detail-info-grid">
                <div>
                  <span>Tipe Permintaan</span>
                  <strong>{submittedDetail.jenisPermintaan}</strong>
                </div>
                <div>
                  <span>Jenis Permintaan</span>
                  <strong>{submittedDetail.jenisPengajuan}</strong>
                </div>
                {submittedDetail.noReqDiganti && (
                  <div>
                    <span>No. Req Diganti</span>
                    <strong>{submittedDetail.noReqDiganti}</strong>
                  </div>
                )}
                <div>
                  <span>Gudang Tujuan</span>
                  <strong>{submittedDetail.gudang}</strong>
                </div>
                <div>
                  <span>Keterangan Pekerjaan</span>
                  <strong>{submittedDetail.pekerjaan}</strong>
                </div>
                <div>
                  <span>Total Material</span>
                  <strong>{submittedDetail.totalMaterial}</strong>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">
                  <h3>Daftar Material</h3>
                </div>

                <div className="detail-material-table">
                  <div className="detail-material-head detail-material-grid">
                    <div>No</div>
                    <div>Kode Material</div>
                    <div>Satuan</div>
                    <div>BA QTY</div>
                    <div>BOQ QTY</div>
                  </div>

                  {submittedDetail.materials.map((item, index) => (
                    <div
                      className="detail-material-row detail-material-grid"
                      key={`${item.kode}-${index}`}
                    >
                      <div>{index + 1}</div>
                      <div>{item.kode || "-"}</div>
                      <div>{item.satuan || "-"}</div>
                      <div>{item.baQty || 0}</div>
                      <div>{item.boqQty || 0}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">
                  <h3>Dokumen Pendukung</h3>
                </div>

                <div className="detail-documents">
                  <DocButton
                    label="SPK"
                    file={submittedDetail.files.spk}
                    onClick={() => bukaPreview(submittedDetail.files.spk)}
                  />
                  <DocButton
                    label="BOQ"
                    file={submittedDetail.files.boq}
                    onClick={() => bukaPreview(submittedDetail.files.boq)}
                  />
                  <DocButton
                    label="BA"
                    file={submittedDetail.files.ba}
                    onClick={() => bukaPreview(submittedDetail.files.ba)}
                  />
                </div>
              </div>
            </div>

            <div className="detail-footer">
              <button type="button" onClick={() => setSubmittedDetail(null)}>
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <PreviewModal
          previewFile={previewFile}
          excelPreview={excelPreview}
          onClose={tutupPreview}
        />
      )}
    </>
  );
}

function UploadBox({
  label,
  file,
  accept,
  description,
  required = false,
  onChange,
  onPreview,
}) {
  return (
    <div className="upload-card">
      <span className="upload-label">
        {label} {required && <b>*</b>}
      </span>

      <label className="upload-dropzone">
        <span className="upload-icon">⇧</span>

        <strong>{file ? file.name : "Klik untuk mengunggah file"}</strong>

        {!file && <span>atau drag and drop</span>}

        <small>{description}</small>

        <input
          type="file"
          hidden
          accept={accept}
          onChange={(e) => {
            onChange(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />
      </label>

      {file && (
        <div className="pengajuan-file-success" role="status" title={file.name}>
          <span className="pengajuan-file-success-icon">✓</span>
          <div>
            <strong>Berhasil diunggah</strong>
            <small>{file.name} · {(file.size / 1024).toLocaleString("id-ID", { maximumFractionDigits: 0 })} KB</small>
          </div>
        </div>
      )}
      {file && (
        <button type="button" className="preview-btn" onClick={onPreview}>
          👁 Preview Dokumen
        </button>
      )}
    </div>
  );
}

function DocButton({ label, file, onClick }) {
  return (
    <button type="button" onClick={onClick}>
      <span>{label}</span>
      <small>{file?.name || "-"}</small>
      <b>Preview</b>
    </button>
  );
}

function PreviewModal({ previewFile, excelPreview, onClose }) {
  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <div>
            <h3>Preview Dokumen</h3>
            <p>{previewFile.file.name}</p>
          </div>

          <button type="button" className="preview-close" onClick={onClose}>
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
  );
}

export default PengajuanMaterial;
