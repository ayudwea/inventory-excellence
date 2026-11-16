/**
 * DATA ILUSTRASI SAJA — untuk uji UI/UX di branch feature/preview-pengajuan-kabel.
 * BUKAN hasil sinkron Google Sheets/Supabase dan BUKAN stok yang benar-benar tersedia.
 * Setiap potongan diberi ID unik agar dua potongan dengan panjang sama tetap dapat dipilih.
 */
const preview = {
  PALEMBANG: {
    "AC-OF-SM-24D": {
      haspelQty: 4000,
      potongan: [
        { id: "PLB-24-001", panjang: 150 },
        { id: "PLB-24-002", panjang: 200 },
        { id: "PLB-24-003", panjang: 1500 },
      ],
    },
    "AC-OF-SM-48D": {
      haspelQty: 4000,
      potongan: [
        { id: "PLB-48-001", panjang: 120 },
        { id: "PLB-48-002", panjang: 380 },
      ],
    },
    "ADSS-12": {
      haspelQty: 4000,
      potongan: [
        { id: "PLB-ADSS-001", panjang: 150 },
        { id: "PLB-ADSS-002", panjang: 200 },
        { id: "PLB-ADSS-003", panjang: 1500 },
      ],
    },
  },
  BENGKULU: {
    "AC-OF-SM-24D": {
      haspelQty: 3000,
      potongan: [
        { id: "BKL-24-001", panjang: 200 },
        { id: "BKL-24-002", panjang: 600 },
      ],
    },
    "ADSS-12": {
      haspelQty: 3000,
      potongan: [
        { id: "BKL-ADSS-001", panjang: 120 },
        { id: "BKL-ADSS-002", panjang: 350 },
      ],
    },
  },
};

export function isMaterialKabel(item) {
  const kode = String(item?.kode || "").toUpperCase();
  const satuan = String(item?.satuan || "").toUpperCase();
  return (satuan === "M" || satuan === "METER") &&
    /^(?:AC-OF|DC-OF|SC-OF|ADSS|OF-)/.test(kode);
}

export function getKabelPreview(gudang, kode) {
  return preview[String(gudang || "").trim().toUpperCase()]?.[
    String(kode || "").trim().toUpperCase()
  ] ?? null;
}

export function ringkasAlokasiKabel(item, gudang) {
  if (!isMaterialKabel(item)) return {
    ...item,
    kabelPotonganDipilih: [],
    kabelPotonganDetail: [],
    totalPotonganDipilih: null,
    poQtyBaru: null,
    sumberStokKabel: null,
  };
  const stok = getKabelPreview(gudang, item.kode);
  if (!stok) return {
    ...item,
    kabelPotonganDipilih: [],
    kabelPotonganDetail: [],
    totalPotonganDipilih: null,
    poQtyBaru: null,
    sumberStokKabel: null,
  };
  const ids = Array.isArray(item.kabelPotonganDipilih) ? item.kabelPotonganDipilih : [];
  const pilihan = stok.potongan.filter((pot) => ids.includes(pot.id));
  const jumlah = pilihan.reduce((sum, pot) => sum + pot.panjang, 0);
  const boq = item.boqQty === "" || item.boqQty == null ? null : Number(item.boqQty);
  return {
    ...item,
    kabelPotonganDipilih: pilihan.map((pot) => pot.id),
    kabelPotonganDetail: pilihan.map((pot) => ({ id: pot.id, panjang: pot.panjang })),
    totalPotonganDipilih: jumlah,
    poQtyBaru: boq === null || !Number.isFinite(boq) || boq < jumlah ? null : boq - jumlah,
    sumberStokKabel: "DEMO_PREVIEW",
  };
}
