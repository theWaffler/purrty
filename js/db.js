// Tiny IndexedDB wrapper. Everything is stored on this device only.
const DB_NAME = 'purrty';
const DB_VERSION = 1;
const STORE = 'people';

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(d => new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const db = {
  all: () => run('readonly', s => s.getAll()),
  get: id => run('readonly', s => s.get(id)),
  put: person => run('readwrite', s => s.put(person)),
  del: id => run('readwrite', s => s.delete(id)),
  clear: () => run('readwrite', s => s.clear()),
};
