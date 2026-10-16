/** Device-only career results cache, isolated by account and cleared on logout. */
export const possibilitiesCacheStorage = {
  getItem(owner: string): string | null {
    try {
      return globalThis.localStorage?.getItem(`aiwrevolusi.possibilities.cache.v1.${owner}`) ?? null;
    } catch {
      return null;
    }
  },
  setItem(owner: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(`aiwrevolusi.possibilities.cache.v1.${owner}`, value);
    } catch {
      // A blocked or full cache must not hide valid API results.
    }
  },
};
