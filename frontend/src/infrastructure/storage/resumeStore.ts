/** Device-only storage. Never registered in the account/workspace sync keys. */
export function createResumeStore(factory: IDBFactory | undefined = globalThis.indexedDB) {
  let connection: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => {
    if (!factory) return Promise.reject(new Error("Local resume storage is unavailable. Export your draft before leaving."));
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open("aiwrevolusi.resume.local.v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("drafts");
      request.onerror = () => { connection = undefined; reject(new Error("Could not open local resume storage. Your existing data has not been overwritten.")); };
      request.onblocked = () => { connection = undefined; reject(new Error("Close other resume tabs and reload to access local drafts.")); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = undefined; };
        resolve(db);
      };
    });
    return connection;
  };
  const validOwner = (owner: string) => {
    if (!owner.trim() || owner.length > 160) throw new Error("Sign in before storing resume data.");
  };
  return {
    async read(owner: string): Promise<unknown> {
      validOwner(owner);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readonly");
        const request = tx.objectStore("drafts").get(owner);
        tx.oncomplete = () => resolve(request.result ?? null);
        tx.onabort = tx.onerror = () => reject(new Error("Your local resume could not be read. It has not been overwritten."));
      });
    },
    async update<T>(owner: string, update: (current: unknown) => T): Promise<T> {
      validOwner(owner);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        const store = tx.objectStore("drafts");
        const request = store.get(owner);
        let result: T;
        let reason: unknown;
        request.onsuccess = () => {
          try { result = update(request.result ?? null); store.put(result, owner); }
          catch (error) { reason = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(reason ?? new Error("Local save failed, possibly because storage is full or blocked. Export before leaving."));
      });
    },
    async clear(owner: string): Promise<void> {
      validOwner(owner);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").delete(owner);
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(new Error("Local resume data could not be cleared."));
      });
    },
    async close() { (await connection)?.close(); connection = undefined; },
  };
}
export const resumeStore = createResumeStore();
