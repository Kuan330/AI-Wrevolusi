/** Rendered PDFs stay in this mounted account's page session, bounded by count and bytes. */
export function createResumePreviewCache(maxEntries = 4, maxBytes = 8 * 1024 * 1024) {
  const entries = new Map<string, Blob>();
  let bytes = 0;
  const remove = (key: string) => {
    const blob = entries.get(key);
    if (blob) { bytes -= blob.size; entries.delete(key); }
  };
  return {
    get(key: string): Blob | undefined {
      const blob = entries.get(key);
      if (blob) { entries.delete(key); entries.set(key, blob); }
      return blob;
    },
    set(key: string, blob: Blob) {
      remove(key);
      if (maxEntries < 1 || blob.size > maxBytes) return;
      entries.set(key, blob); bytes += blob.size;
      while (entries.size && (entries.size > maxEntries || bytes > maxBytes)) remove(entries.keys().next().value!);
    },
    clear() { entries.clear(); bytes = 0; },
  };
}
