/**
 * Penyimpanan draft FRONTEND demo di IndexedDB yang sama dengan request lokal.
 * IndexedDB dapat menyimpan objek File; jangan simpan dokumen sensitif untuk produksi.
 */
const DATABASE_NAME = "mira_inventory_local";
const STORE_NAME = "state";
const DRAFT_KEY = "pengajuan_draft_v1";

function openDraftDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser tidak mendukung IndexedDB."));
      return;
    }
    const req = indexedDB.open(DATABASE_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Tidak dapat membuka database draft."));
  });
}

async function transactionDraft(mode, action) {
  const db = await openDraftDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      let result;
      const req = action(tx.objectStore(STORE_NAME));
      if (req) {
        req.onsuccess = () => { result = req.result; };
        req.onerror = () => reject(req.error);
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function bacaDraftPengajuan() {
  return (await transactionDraft("readonly", (store) => store.get(DRAFT_KEY))) || null;
}

export async function simpanDraftPengajuan(data) {
  const record = { ...data, savedAt: new Date().toISOString() };
  await transactionDraft("readwrite", (store) => store.put(record, DRAFT_KEY));
  return record;
}

export async function hapusDraftPengajuan() {
  await transactionDraft("readwrite", (store) => store.delete(DRAFT_KEY));
}
