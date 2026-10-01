type Entry<T> = { value: T; at: number };
type Options = {
  maxAgeMs: number;
  /** Persist across reloads. Only for shared reference data, never for a person's own wording. */
  storageKey?: string;
  now?: () => number;
  storage?: () => Storage | undefined;
};

const browserStorage = () => (typeof localStorage === "undefined" ? undefined : localStorage);

/**
 * Keeps successful responses so pages can render at once on a repeat visit.
 * Failures are never cached, so the next call retries.
 */
export function createRequestCache<T>({ maxAgeMs, storageKey, now = Date.now, storage = browserStorage }: Options) {
  const memory = new Map<string, Entry<T>>();
  const pending = new Map<string, Promise<T>>();
  let restored = !storageKey;

  function restore() {
    if (restored) return;
    restored = true;
    try {
      const raw = storage()?.getItem(storageKey!);
      const saved = raw ? JSON.parse(raw) as Record<string, Entry<T>> : {};
      for (const [key, entry] of Object.entries(saved)) {
        if (entry && typeof entry.at === "number" && "value" in entry) memory.set(key, entry);
      }
    } catch { /* An unreadable cache only means one more request. */ }
  }

  function persist() {
    if (!storageKey) return;
    try { storage()?.setItem(storageKey, JSON.stringify(Object.fromEntries(memory))); }
    catch { /* A full or blocked storage keeps the in-memory copy. */ }
  }

  /** The cached value, if any, and whether it is still within its age limit. */
  function peek(key: string): { value: T; fresh: boolean } | undefined {
    restore();
    const entry = memory.get(key);
    return entry ? { value: entry.value, fresh: now() - entry.at <= maxAgeMs } : undefined;
  }

  function set(key: string, value: T) {
    restore();
    memory.set(key, { value, at: now() });
    persist();
  }

  /** Returns a fresh cached value, or runs one shared request for every caller. */
  function load(key: string, request: () => Promise<T>): Promise<T> {
    const cached = peek(key);
    if (cached?.fresh) return Promise.resolve(cached.value);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const next = request()
      .then(value => { set(key, value); return value; })
      .finally(() => { pending.delete(key); });
    pending.set(key, next);
    return next;
  }

  function clear() {
    memory.clear();
    pending.clear();
    try { if (storageKey) storage()?.removeItem(storageKey); } catch { /* Nothing else to clear. */ }
  }

  return { peek, set, load, clear };
}
