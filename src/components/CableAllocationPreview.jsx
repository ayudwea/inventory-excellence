import { useState } from "react";
import { getKabelPreview, ringkasAlokasiKabel } from "../data/kabelPotonganPreview.js";

const angka = (value) =>
  Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

export default function CableAllocationPreview({ item, gudang, onSelectPotongan }) {
  const [terbuka, setTerbuka] = useState(false);
  const stok = getKabelPreview(gudang, item.kode);
  const data = stok ? ringkasAlokasiKabel(item, gudang) : null;
  const qtyBoq = item.boqQty === "" || item.boqQty == null
    ? null
    : Number(item.boqQty);
  const totalPotongan = stok?.potongan.reduce((sum, pot) => sum + pot.panjang, 0) ?? null;
  const totalHaspel = stok?.haspelQty ?? null;
  const totalKabel = stok ? totalPotongan + totalHaspel : null;
  const terpilih = data?.kabelPotonganDipilih || [];
  const alokasi = data?.totalPotonganDipilih ?? 0;
  const kelebihan = qtyBoq !== null && Number.isFinite(qtyBoq) && alokasi > qtyBoq;
  const belumAdaBoq = qtyBoq === null || !Number.isFinite(qtyBoq) || qtyBoq <= 0;
  const poQtyBaru = data?.poQtyBaru;

  function togglePotongan(id) {
    onSelectPotongan(
      terpilih.includes(id)
        ? terpilih.filter((value) => value !== id)
        : [...terpilih, id]
    );
  }

  return (
    <section className="mira-cable-preview" aria-label={`Simulasi alokasi kabel ${item.kode}`}>
      <div className="mira-cable-preview-heading">
        <div>
          <span className="mira-cable-kicker">PENGAJUAN KHUSUS KABEL</span>
          <h3>Alokasi Kabel Potongan <span className="mira-cable-code">{item.kode}</span></h3>
          <p>User memilih potongan sendiri. MIRA menghitung PO QTY Baru otomatis berdasarkan BOQ.</p>
        </div>
        <span className="mira-cable-demo-label">DATA SIMULASI</span>
      </div>

      {!gudang ? (
        <p className="mira-cable-empty">Pilih gudang tujuan untuk menampilkan stok kabel potongan dan haspel.</p>
      ) : !stok ? (
        <p className="mira-cable-empty">Belum ada data simulasi untuk kombinasi {gudang} / {item.kode}. Data stok aktual dari Google Sheets dan Supabase belum dihubungkan.</p>
      ) : (
        <>
          <div className="mira-cable-stats">
            <div className="mira-cable-stat">
              <span>KABEL POTONGAN</span>
              <strong>{angka(totalPotongan)} <small>m</small></strong>
              <em>{stok.potongan.length} potongan tersedia</em>
            </div>
            <div className="mira-cable-stat">
              <span>KABEL HASPEL</span>
              <strong>{angka(totalHaspel)} <small>m</small></strong>
              <em>Hanya informasi stok</em>
            </div>
            <div className="mira-cable-stat mira-cable-stat-total">
              <span>TOTAL STOK KABEL</span>
              <strong>{angka(totalKabel)} <small>m</small></strong>
              <em>Potongan + haspel</em>
            </div>
          </div>

          <div className="mira-cable-picker">
            <button
              type="button"
              className="mira-cable-picker-trigger"
              onClick={() => setTerbuka((prev) => !prev)}
              aria-expanded={terbuka}
            >
              <span>
                <strong>Pilih kabel potongan tersedia</strong>
                <small>{terpilih.length} dari {stok.potongan.length} potongan dipilih</small>
              </span>
              <span aria-hidden="true">{terbuka ? "⌃" : "⌄"}</span>
            </button>
            {terbuka && (
              <div className="mira-cable-cut-options">
                {stok.potongan.map((pot) => (
                  <label key={pot.id} className="mira-cable-cut-option">
                    <input
                      type="checkbox"
                      checked={terpilih.includes(pot.id)}
                      onChange={() => togglePotongan(pot.id)}
                    />
                    <span><b>{pot.id}</b><small>Gudang {gudang}</small></span>
                    <strong>{angka(pot.panjang)} m</strong>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mira-cable-calculation">
            <div className="mira-cable-calc-row">
              <span>Kebutuhan BOQ (tetap)</span>
              <strong>{belumAdaBoq ? "Masukkan BOQ QTY dahulu" : `${angka(qtyBoq)} m`}</strong>
            </div>
            <div className="mira-cable-calc-row">
              <span>Total potongan dipilih user</span>
              <strong className="mira-cable-subtract">− {angka(alokasi)} m</strong>
            </div>
            <div className="mira-cable-po-result">
              <span>PO QTY BARU <small>Terhitung otomatis — bukan outstanding PO_QTY SAP</small></span>
              <strong>{poQtyBaru === null || belumAdaBoq ? "—" : `${angka(poQtyBaru)} m`}</strong>
            </div>
          </div>
          {kelebihan && <p className="mira-cable-error" role="alert">Total potongan terpilih melebihi BOQ QTY. Kurangi pilihan untuk bisa submit.</p>}
          <p className="mira-cable-disclaimer">Contoh stok untuk uji tampilan, bukan data gudang aktual. BA QTY dan BOQ QTY tidak berubah. PO QTY Baru = BOQ QTY − total potongan pilihan PIC; pemakaian haspel tidak otomatis mengurangi PO.</p>
        </>
      )}
    </section>
  );
}
