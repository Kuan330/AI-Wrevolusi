import { emptyContacts, type Contacts, type ResumeEvidence } from "./types.ts";
const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+\d[\d ().-]{6,}\d|\b\d{9,15}\b|\b(?:\(\d{2,4}\)|\d{2,4})[ .-]\d{3,4}[ .-]\d{3,4}\b)/g;
export function detectContacts(text: string): Contacts {
  const contacts = emptyContacts();
  contacts.email = text.match(EMAIL)?.[0] ?? "";
  contacts.phone = text.match(PHONE)?.[0] ?? "";
  const first = text.split(/\r?\n/).find(line => line.trim())?.trim() ?? "";
  if (first.length <= 80 && !/@|\d|resume|curriculum|skills|experience/i.test(first)) contacts.name = first;
  return contacts;
}
export function redactResume(text: string, contacts: Contacts): string {
  let result = text;
  for (const value of Object.values(contacts).sort((a, b) => b.length - a.length)) {
    if (value.trim()) result = result.split(value.trim()).join("[REDACTED]");
  }
  return result.replace(EMAIL, "[REDACTED]").replace(PHONE, "[REDACTED]");
}
export function evidenceFromText(text: string): ResumeEvidence[] {
  if (text.length > 60000) throw new Error("Reviewed resume text must be at most 60,000 characters.");
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && line !== "[REDACTED]");
  const chunks = lines.flatMap(line => line.match(/.{1,1800}/gu) ?? []);
  if (chunks.length > 500) throw new Error("Too many resume paragraphs. Remove unrelated content.");
  return chunks.map((text, index) => ({ id: `fact-${index + 1}`, text }));
}
