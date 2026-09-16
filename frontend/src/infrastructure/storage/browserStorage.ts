export const browserStorage = {
  getItem(key: string): string | null {
    return globalThis.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    globalThis.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    globalThis.localStorage.removeItem(key);
  },
  keys(): string[] {
    return Object.keys(globalThis.localStorage);
  },
};
