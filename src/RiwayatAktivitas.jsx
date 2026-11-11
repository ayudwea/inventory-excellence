import { useState } from "react";
import * as XLSX from "xlsx";
import "./MonitoringProyek.css";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric"
  }).format(date);
}

export default function RiwayatAktivitas({ requests = [] }) {
  const [filterRiwayat, setFilterRiwayat] = useState("SEMUA");
  const [cariRiwayat, setCariRiwayat] = useState("");
  const [detail, setDetail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [excelRows, setExcelRows] = useState([]);

  const riwayatTampil = requests.filter((r) => {
    const cocokStatus = filterRiwayat === "SEMUA" || r.status === filterRiwayat;
    const term = cariRiwayat.trim().toLowerCase();
    const cocokCari = !term || [r.requestId, r.gudang, r.pekerjaan, r.jenisPengajuan]
      .some((v) => String(v || "").toLowerCase().includes(term));
    return cocokStatus && cocokCari;
  });

  async function bukaPreview(file) {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      setExcelRows([]);
      setPreview({ name: file.name, type: "pdf", url: URL.createObjectURL(file) });
    } else if (["xls", "xlsx"].includes(ext)) {
      try {
        const book = XLSX.read(await file.arrayBuffer());
        setExcelRows(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: "" }));
        setPreview({ name: file.name, type: "excel" });
      } catch (error) {
        console.error(error);
        alert("Tidak dapat membaca file Excel.");
      }
    }
  }

  function tutupPreview() {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setExcelRows([]);
  }

  return (
    <>
      <section className="pengajuan-history-card monitoring-page" aria-label="Riwayat Aktivitas">
        <div className="pengajuan-history-header">
          <div>
            <span>AKTIVITAS PENGAJUAN</span>
            <h2>Riwayat Pengajuan</h2>
            <p>Lihat nomor request dan perkembangan pemeriksaan serta evaluasi.</p>
          </div>
          <span className="pengajuan-history-count">{requests.length} Pengajuan</span>
        </div>
        <div className="pengajuan-history-filter">
          <input
            aria-label="Cari Request ID atau gudang"
            placeholder="Cari Request ID, gudang, pekerjaan..."
            value={cariRiwayat}
            onChange={(e) => setCariRiwayat(e.target.value)}
          />
          <select
            aria-label="Filter status pengajuan"
            value={filterRiwayat}
            onChange={(e) => setFilterRiwayat(e.target.value)}
          >
            <option value="SEMUA">Semua Status</option>
            {[...new Set(requests.map((r) => r.status).filter(Boolean))].map((s) => (
              <option value={s} key={s}>{s}</option>
            ))}
          </select>
        </div>
        {riwayatTampil.length ? (
          <div className="pengajuan-history-list">
            {riwayatTampil.map((r) => (
              <div className="pengajuan-history-row" key={r.requestId}>
                <div className="pengajuan-history-main">
                  <strong>{r.requestId}</strong>
                  <span>{r.jenisPermintaan || r.tipePermintaan || "-"} · {r.jenisPengajuan || "BARU"} · {r.gudang || "-"} · {r.pekerjaan || "-"}</span>
                </div>
                <div className="pengajuan-history-meta">
                  <small>{formatDate(r.tanggalInput)}</small>
                  <span className="pengajuan-history-status">{r.status || "-"}</span>
                </div>
                <button type="button" onClick={() => setDetail(r)}>Lihat Detail</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="pengajuan-history-empty">
            {requests.length
              ? "Tidak ada pengajuan yang cocok dengan filter."
              : "Belum ada pengajuan tersimpan. Request baru akan muncul setelah Submit berhasil."}
          </div>
        )}
        <p className="pengajuan-history-footnote">
          Riwayat ini sementara menampilkan pengajuan pada browser MIRA yang sama. Pemisahan per akun PIC membutuhkan login dan database terpusat.
        </p>
      </section>

      {detail && (
        <div className="detail-overlay" onClick={() => setDetail(null)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <span className="detail-kicker">DETAIL PENGAJUAN</span>
                <h2>{detail.requestId}</h2>
                <p>{detail.jenisPermintaan} · {detail.jenisPengajuan || "BARU"} · {detail.gudang} · {detail.pekerjaan}</p>
              </div>
              <button type="button" className="detail-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="detail-body">
              <div className="detail-status"><span>Status</span><strong>{detail.status || "-"}</strong></div>
              <div className="detail-info-grid">
                <div><span>Tipe Permintaan</span><strong>{detail.jenisPermintaan || "-"}</strong></div>
                <div><span>Jenis Permintaan</span><strong>{detail.jenisPengajuan || "BARU"}</strong></div>
                <div><span>Gudang Tujuan</span><strong>{detail.gudang || "-"}</strong></div>
                <div><span>Nama Pekerjaan</span><strong>{detail.pekerjaan || "-"}</strong></div>
                <div><span>Tanggal Input</span><strong>{formatDate(detail.tanggalInput)}</strong></div>
                <div><span>No. Req Diganti</span><strong>{detail.noReqDiganti || "-"}</strong></div>
                <div><span>Status PR</span><strong>{detail.statusPR || detail.prStatus || (detail.noPR ? "Sudah PR" : "Belum PR")}</strong></div>
                <div><span>Total Material</span><strong>{detail.materials?.length || 0} item</strong></div>
              </div>
              {(detail.catatanChecker || detail.alasanTolakManager) && (
                <div className="detail-section">
                  <div className="detail-section-title"><h3>Alasan Ditolak</h3></div>
                  {detail.catatanChecker && (
                    <p><strong>Checker:</strong> {detail.catatanChecker}</p>
                  )}
                  {detail.alasanTolakManager && (
                    <p><strong>Manager:</strong> {detail.alasanTolakManager}</p>
                  )}
                </div>
              )}
              <div className="detail-section">
                <div className="detail-section-title"><h3>Daftar Material</h3></div>
                <div className="detail-material-table">
                  <div className="detail-material-head detail-material-grid">
                    <div>No</div><div>Kode Material</div><div>Satuan</div><div>BA QTY</div><div>BOQ QTY</div>
                  </div>
                  {(detail.materials || []).map((item, index) => (
                    <div className="detail-material-row detail-material-grid" key={`${item.kode}-${index}`}>
                      <div>{index + 1}</div><div>{item.kode || "-"}</div><div>{item.satuan || "-"}</div><div>{item.baQty ?? 0}</div><div>{item.boqQty ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="detail-section">
                <div className="detail-section-title"><h3>Dokumen Pendukung</h3></div>
                <div className="detail-documents">
                  {["spk", "boq", "ba"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={!detail.files?.[key]}
                      onClick={() => bukaPreview(detail.files?.[key])}
                    >
                      <span>{key.toUpperCase()}</span>
                      <small>{detail.files?.[key]?.name || "Tidak tersedia"}</small>
                      <b>{detail.files?.[key] ? "Preview Dokumen" : "Tidak tersedia"}</b>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="detail-footer"><button type="button" onClick={() => setDetail(null)}>Tutup Detail</button></div>
          </div>
        </div>
      )}

      {preview && (
        <div className="preview-overlay" onClick={tutupPreview}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <div><h3>Preview Dokumen</h3><p>{preview.name}</p></div>
              <button type="button" className="preview-close" onClick={tutupPreview}>✕</button>
            </div>
            <div className="preview-content">
              {preview.type === "pdf" ? (
                <iframe className="preview-frame" src={preview.url} title="Preview PDF" />
              ) : (
                <div className="excel-preview">
                  <table><tbody>
                    {excelRows.map((row, ri) => (
                      <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{String(cell)}</td>)}</tr>
                    ))}
                  </tbody></table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
