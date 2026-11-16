import { useEffect, useMemo, useRef, useState } from "react";
import { getKabelPreview } from "../data/kabelPotonganPreview.js";
import "./CableAllocationModal.css";

const formatQty = (number) =>
  Number(number ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

/**
 * Popup eksplisit untuk PIC memilih potongan.
 * Pilihan belum mengubah data pengajuan hingga tombol "Terapkan Pilihan" diklik.
 */
export default function CableAllocationModal({ open, item, gudang, onClose, onApply }) {
  const [selection, setSelection] = useState([]);
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const searchRef = useRef(null);

  const stok = getKabelPreview(gudang, item?.kode);
  const daftar = stok?.potongan ?? [];
  const boq = item?.boqQty === "" || item?.boqQty == null ? null : Number(item.boqQty);
  const isBoqValid = boq !== null && Number.isFinite(boq) && boq > 0;
  const potonganDipilih = useMemo(
    () => daftar.filter((potongan) => selection.includes(potongan.id)),
    [daftar, selection]
  );
  const totalDipilih = potonganDipilih.reduce((total, itemPotong) => total + itemPotong.panjang, 0);
  const totalPotongan = daftar.reduce((total, itemPotong) => total + itemPotong.panjang, 0);
  const totalHaspel = stok?.haspelQty ?? 0;
  const poQtyBaru = isBoqValid ? boq - totalDipilih : null;
  const over = poQtyBaru !== null && poQtyBaru < 0;
  const filtered = daftar.filter((potongan) => {
    const found = !search.trim() ||
      `${potongan.id} ${potongan.panjang}`.toLowerCase().includes(search.trim().toLowerCase());
    return found && (!onlySelected || selection.includes(potongan.id));
  });

  useEffect(() => {
    if (!open) return;
    const validIds = (item?.kabelPotonganDipilih ?? []).filter((id) =>
      daftar.some((pot) => pot.id === id)
    );
    setSelection(validIds);
    setSearch("");
    setOnlySelected(false);
    searchRef.current?.focus();
  }, [open, item?.kode, gudang]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  function toggle(id) {
    setSelection((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]
    );
  }

  function apply() {
    if (!stok || !isBoqValid || over) return;
    onApply(selection.filter((id) => daftar.some((pot) => pot.id === id)));
    onClose();
  }

  return (
    <div className="mira-cm-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="mira-cm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mira-cm-title"
      >
        <header className="mira-cm-header">
          <div>
            <span className="mira-cm-eyebrow">ALOKASI KABEL · PREVIEW UI</span>
            <h2 id="mira-cm-title">Pilih Kabel Potongan</h2>
            <p><strong>{item.kode}</strong> <span aria-hidden="true">·</span> {gudang || "Gudang belum dipilih"}</p>
          </div>
          <button type="button" className="mira-cm-close" aria-label="Tutup pemilihan kabel" onClick={onClose}>×</button>
        </header>

        <div className="mira-cm-content">
          <p className="mira-cm-demo-note">DATA SIMULASI — belum terhubung Google Sheets / Supabase. PIC menentukan sendiri kabel potongan yang dipakai.</p>

          <div className="mira-cm-stats">
            <div><span>Stok Potongan</span><strong>{stok ? formatQty(totalPotongan) : "—"} <small>m</small></strong><small>{daftar.length} potong</small></div>
            <div><span>Stok Haspel</span><strong>{stok ? formatQty(totalHaspel) : "—"} <small>m</small></strong><small>Hanya informasi</small></div>
            <div className="mira-cm-total"><span>Total Kabel</span><strong>{stok ? formatQty(totalPotongan + totalHaspel) : "—"} <small>m</small></strong><small>Potongan + haspel</small></div>
          </div>

          {stok ? (
            <>
              <div className="mira-cm-list-head">
                <div><strong>Daftar Potongan Tersedia</strong><small>Centang satu atau beberapa potongan kabel.</small></div>
                <span>{selection.length} dipilih</span>
              </div>
              <div className="mira-cm-filters">
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari panjang atau ID potongan..."
                  aria-label="Cari kabel potongan"
                />
                <label><input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)}/> Dipilih saja</label>
              </div>

              <div className="mira-cm-list">
                {filtered.map((potongan) => (
                  <label key={potongan.id} className={`mira-cm-cut ${selection.includes(potongan.id) ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selection.includes(potongan.id)}
                      onChange={() => toggle(potongan.id)}
                      aria-label={`Pilih potongan ${potongan.id}, ${formatQty(potongan.panjang)} meter`}
                    />
                    <span><strong>{potongan.id}</strong><small>Potongan kabel</small></span>
                    <b>{formatQty(potongan.panjang)} m</b>
                  </label>
                ))}
                {!filtered.length && <p className="mira-cm-empty">Tidak ada potongan sesuai pencarian atau filter.</p>}
              </div>
            </>
          ) : (
            <p className="mira-cm-empty">Data potongan untuk material dan gudang ini belum tersedia pada simulasi. Tidak ada stok aktual yang ditampilkan.</p>
          )}
        </div>

        <footer className="mira-cm-footer">
          <div className="mira-cm-summary">
            <div><span>BOQ QTY</span><strong>{isBoqValid ? `${formatQty(boq)} m` : "Belum diisi"}</strong></div>
            <div><span>Potongan dipilih</span><strong className="mira-cm-deduct">− {formatQty(totalDipilih)} m</strong></div>
            <div className="mira-cm-po"><span>PO QTY BARU · OTOMATIS</span><strong>{poQtyBaru === null || over ? "—" : `${formatQty(poQtyBaru)} m`}</strong></div>
          </div>
          {over && <p className="mira-cm-error" role="alert">Potongan terpilih melebihi BOQ. Kurangi pilihan terlebih dahulu.</p>}
          {!isBoqValid && <p className="mira-cm-error" role="alert">Isi BOQ QTY pada form pengajuan terlebih dahulu.</p>}
          <p className="mira-cm-footnote">BA dan BOQ tetap sesuai dokumen. PO QTY Baru adalah estimasi sisa setelah potongan pilihan user; bukan data outstanding PO SAP.</p>
          <div className="mira-cm-actions">
            <button type="button" className="mira-cm-cancel" onClick={onClose}>Batal</button>
            <button type="button" className="mira-cm-apply" onClick={apply} disabled={!stok || !isBoqValid || over}>Terapkan Pilihan</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
