/** Temporary drafts are kept in this browser tab, separate from account evidence. */
function assertDraftKey(key: string) {
  if (!key.startsWith("aiwrevolusi.goalDraft.v1:")) throw new Error("This adapter only stores learning goal drafts.");
}
export const learningGoalDraftStorage = {
  getItem(key: string): string | null { assertDraftKey(key); return sessionStorage.getItem(key); },
  setItem(key: string, value: string): void { assertDraftKey(key); sessionStorage.setItem(key, value); },
  removeItem(key: string): void { assertDraftKey(key); sessionStorage.removeItem(key); },
};
