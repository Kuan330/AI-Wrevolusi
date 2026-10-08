/** Device-only storage for interview practice. Never registered in the account/workspace sync keys. */
export function createInterviewStore(factory: IDBFactory | undefined = globalThis.indexedDB) {
  let connection: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => {
    if (!factory) return Promise.reject(new Error("Local storage is unavailable, so practice cannot be saved on this device."));
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open("aiwrevolusi.interview.local.v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("sessions");
      request.onerror = () => { connection = undefined; reject(new Error("Could not open local practice storage. Your existing practice has not been overwritten.")); };
      request.onblocked = () => { connection = undefined; reject(new Error("Close other tabs of this app and reload to open your saved practice.")); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = undefined; };
        resolve(db);
      };
    });
    return connection;
  };
  const validOwner = (owner: string) => { if (!owner.trim() || owner.length > 160) throw new Error("Sign in before saving practice."); };
  return {
    async read(owner: string): Promise<unknown> {
      validOwner(owner);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readonly");
        const request = tx.objectStore("sessions").get(owner);
        tx.oncomplete = () => resolve(request.result ?? null);
        tx.onabort = tx.onerror = () => reject(new Error("Your saved practice could not be read. It has not been overwritten."));
      });
    },
    async update<T>(owner: string, update: (current: unknown) => T): Promise<T> {
      validOwner(owner);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readwrite");
        const store = tx.objectStore("sessions");
        const request = store.get(owner);
        let result: T;
        let reason: unknown;
        request.onsuccess = () => {
          try { result = update(request.result ?? null); store.put(result, owner); }
          catch (error) { reason = error; tx.abort(); }
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(reason ?? new Error("Practice could not be saved, possibly because storage is full or blocked."));
      });
    },
    async clear(owner: string): Promise<void> {
      validOwner(owner);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readwrite");
        tx.objectStore("sessions").delete(owner);
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(new Error("Saved practice could not be deleted."));
      });
    },
  };
}
export const interviewStore = createInterviewStore();
