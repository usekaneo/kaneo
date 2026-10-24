// A single-store IndexedDB key-value wrapper. IndexedDB holds a task-heavy
// query cache that would overflow localStorage's few megabytes.
const DB_NAME = "kaneo-offline";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const idbStore = {
  get: <T>(key: string) =>
    run<T | undefined>("readonly", (store) => store.get(key)),
  set: (key: string, value: unknown) =>
    run("readwrite", (store) => store.put(value, key)).then(() => undefined),
  remove: (key: string) =>
    run("readwrite", (store) => store.delete(key)).then(() => undefined),
};
