/** Device-only UI preferences. Never use this for account workspace records. */
export const localPreferences = {
  getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Remembering a UI preference is optional when browser storage is blocked.
    }
  },
};
