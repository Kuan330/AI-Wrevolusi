/** Device-local developer preference. Never part of account workspace sync. */
export const MODEL_PREFERENCE_KEY = "aiwrevolusi.developerModels.v1";
const listeners = new Set<() => void>();
let initialized = false, encoded = "", listening = false, revision = 0;
export function validateModelIds(values: unknown): string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 5) throw new Error("Add between one and five models.");
  const models = values.map(value => typeof value === "string" ? value.trim() : "");
  if (models.some(value => !/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,159}$/.test(value))) throw new Error("Enter a valid model ID (up to 160 characters).");
  if (new Set(models).size !== models.length) throw new Error("Each model ID must be unique.");
  return models;
}
function load() {
  try { const value = window.localStorage.getItem(MODEL_PREFERENCE_KEY); return value ? JSON.stringify(validateModelIds(JSON.parse(value))) : ""; }
  catch { return ""; }
}
function notify(value: string) { if (encoded !== value) { encoded = value; revision++; for (const listener of listeners) listener(); } }
export function modelPreferenceSnapshot(): string {
  if (!initialized && typeof window !== "undefined") { encoded = load(); initialized = true; }
  return encoded;
}
export function modelPreferenceRevision(): number { modelPreferenceSnapshot(); return revision; }
export function readModelIds(): string[] { const value = modelPreferenceSnapshot(); return value ? JSON.parse(value) as string[] : []; }
export function subscribeModelPreferences(listener: () => void): () => void {
  modelPreferenceSnapshot();
  listeners.add(listener);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("storage", event => { if (event.key === MODEL_PREFERENCE_KEY || event.key === null) notify(load()); });
  }
  return () => { listeners.delete(listener); };
}
export function saveModelIds(values: string[]): void {
  const value = JSON.stringify(validateModelIds(values));
  window.localStorage.setItem(MODEL_PREFERENCE_KEY, value);
  initialized = true; notify(value);
}
export function restoreDefaultModels(): void {
  window.localStorage.removeItem(MODEL_PREFERENCE_KEY);
  initialized = true; notify("");
}
export function isAIRequest(path: string): boolean {
  return /^\/(ai|guided-learning|skill-directions)(\/|$)/.test(path) ||
    /^\/resume\/(generate|assist|recommend-courses)(\?|$)/.test(path) ||
    /^\/exposure\//.test(path) || /^\/learning\/(summary|daily-brief)(\?|$)/.test(path) ||
    /^\/reference\/occupations(\?|$)/.test(path);
}
