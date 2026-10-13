import { entryText } from "./document.ts";
import type { ResumeEntry } from "./types.ts";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
/** A short name for an entry, such as "Analyst, Acme". Used to show where a practice question or suggestion belongs. */
export function entryLabel(entry: ResumeEntry): string {
  if (typeof entry === "string") return entry.trim().slice(0, 80);
  const role = [text(entry.position), text(entry.company)].filter(Boolean).join(", ");
  const named = role || text(entry.name) || text(entry.title) || [text(entry.degree), text(entry.institution)].filter(Boolean).join(", ") || text(entry.label);
  return (named || text(entry.bullet) || text(entry.text) || entryText(entry)).slice(0, 80);
}
