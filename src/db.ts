const DB_NAME = 'minddrop';
const STORE_NAME = 'records';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecords(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev');
    const records: any[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        records.push(cursor.value);
        cursor.continue();
      } else {
        resolve(records);
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getRecord(id: string): Promise<any | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveRecord(record: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportAllRecords(): Promise<any[]> {
  return await getAllRecords();
}

export async function importRecords(records: any[]): Promise<{ imported: number; skipped: number; merged: number }> {
  const existing = await getAllRecords();
  const existingMap = new Map(existing.map(r => [r.id, r]));

  let imported = 0;
  let merged = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.id) { skipped++; continue; }
    const exist = existingMap.get(record.id);
    if (exist) {
      if (new Date(record.updatedAt) > new Date(exist.updatedAt)) {
        await saveRecord(record);
        merged++;
      } else {
        skipped++;
      }
    } else {
      await saveRecord(record);
      imported++;
    }
  }

  return { imported, merged, skipped };
}
