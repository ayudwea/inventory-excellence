const masterStokDummy = [
  { warehouse: "BENGKULU", materialCode: "ADSS-12", unit: "M", sapQty: 4000 },
  { warehouse: "BENGKULU", materialCode: "ODP-SOLID-8-L", unit: "PCS", sapQty: 125 },
  { warehouse: "BENGKULU", materialCode: "PIGTAIL-SC", unit: "PCS", sapQty: 350 },
  { warehouse: "PALEMBANG", materialCode: "ADSS-12", unit: "M", sapQty: 12000 },
  { warehouse: "PALEMBANG", materialCode: "ODP-SOLID-8-L", unit: "PCS", sapQty: 240 },
  { warehouse: "PALEMBANG", materialCode: "PIGTAIL-SC", unit: "PCS", sapQty: 680 },
  { warehouse: "MEDAN", materialCode: "ADSS-12", unit: "M", sapQty: 20000 },
  { warehouse: "MEDAN", materialCode: "ODP-SOLID-8-L", unit: "PCS", sapQty: 460 },
  { warehouse: "MEDAN", materialCode: "PIGTAIL-SC", unit: "PCS", sapQty: 1250 },
  { warehouse: "PADANG", materialCode: "ADSS-12", unit: "M", sapQty: 8000 },
  { warehouse: "PADANG", materialCode: "ODP-SOLID-8-L", unit: "PCS", sapQty: 180 },
  { warehouse: "PADANG", materialCode: "PIGTAIL-SC", unit: "PCS", sapQty: 520 },
  { warehouse: "PEKANBARU", materialCode: "ADSS-12", unit: "M", sapQty: 16000 },
  { warehouse: "PEKANBARU", materialCode: "ODP-SOLID-8-L", unit: "PCS", sapQty: 310 },
  { warehouse: "PEKANBARU", materialCode: "PIGTAIL-SC", unit: "PCS", sapQty: 890 },
];

export function getDummyStock(warehouse, materialCode) {
  return masterStokDummy.find(
    (item) =>
      item.warehouse === warehouse && item.materialCode === materialCode
  );
}

export default masterStokDummy;
