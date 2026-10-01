/** Reference-data cache only. Browser storage access stays inside its infrastructure adapter. */
export function referenceCacheStorage(): Storage | undefined {
  try { return globalThis.localStorage; }
  catch { return undefined; }
}
