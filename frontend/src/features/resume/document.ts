import { LineCounter, parseDocument, stringify } from "yaml";
import Ajv2020 from "ajv/dist/2020.js";
import schema from "./rendercv-2.8.schema.json" with { type: "json" };
import type { Contacts, GeneratedSection, ResumeDocument, ResumeEntry } from "./types.ts";
export const THEMES = ["classic", "ember", "engineeringclassic", "engineeringresumes", "harvard", "ink", "moderncv", "opal", "sb2nov"] as const;
const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true });
const validate = ajv.compile(schema);
export function parseResumeYaml(text: string): { document: ResumeDocument | null; error: string } {
  try {
    if (text.length > 150000) throw new Error("YAML exceeds the supported text limit.");
    const lineCounter = new LineCounter();
    const parsed = parseDocument(text, { lineCounter, uniqueKeys: true });
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);
    const value = parsed.toJS({ maxAliasCount: 20 }) as ResumeDocument;
    if (!value || typeof value !== "object" || !value.cv || typeof value.cv !== "object" || Array.isArray(value.cv)) throw new Error("The document needs a cv mapping.");
    // Match the Python builder's implicit classic theme without altering YAML.
    const validationValue = value.design && typeof value.design === "object" && !Array.isArray(value.design) && value.design.theme === undefined
      ? { ...value, design: { ...value.design, theme: "classic" } } : value;
    if (!validate(validationValue)) {
      const issue = validate.errors?.[0];
      throw new Error(`${issue?.instancePath || "/"}: ${issue?.message || "Invalid RenderCV value"}`);
    }
    if (value.cv.photo) throw new Error("Photos/external resources are not supported in this version.");
    if (value.design && (!THEMES.includes((value.design.theme ?? "classic") as typeof THEMES[number]) || Object.hasOwn(value.design, "templates"))) throw new Error("Use an included theme; template code is not supported.");
    if (value.settings && Object.keys(value.settings).some(key => !["current_date", "bold_keywords", "pdf_title"].includes(key))) throw new Error("Output paths and render commands are controlled by the server.");
    // Prevent prototype keys, recursive structures, and resource/code injection before rendering.
    let nodes = 0;
    const inspect = (item: unknown, depth = 0) => {
      if (++nodes > 10000 || depth > 18) throw new Error("The document is too complex.");
      if (typeof item === "string" && ((/#[A-Za-z_]/.test(item.replace(/https?:\/\/[^\s"<>]+/g, "")) && !/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?$/.test(item)) || item.includes("$$"))) throw new Error("Raw Typst code is not supported.");
      if (typeof item === "string" && (/\]\(\s*(?!https?:\/\/|mailto:|tel:)[^\s)]/i.test(item) || item.includes("!["))) throw new Error("Local file links and embedded resources are not supported.");
      if (item && typeof item === "object") for (const [key, child] of Object.entries(item)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Invalid YAML field.");
        inspect(child, depth + 1);
      }
    };
    inspect(value);
    return { document: value, error: "" };
  } catch (cause) { return { document: null, error: cause instanceof Error ? cause.message : "Invalid YAML." }; }
}
export const documentYaml = (document: ResumeDocument) => stringify(document, { lineWidth: 0 });
export function applySections(document: ResumeDocument | null, sections: GeneratedSection[], contacts?: Contacts): ResumeDocument {
  const next = structuredClone(document ?? { cv: {}, design: { theme: "engineeringresumes" } });
  next.cv.sections = { ...next.cv.sections };
  for (const section of sections) next.cv.sections[section.title] = section.entries.map(entry => ({ bullet: entry.text }));
  if (!document && contacts) for (const [key, value] of Object.entries(contacts)) if (value.trim()) next.cv[key] = value.trim();
  return next;
}
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const result = [...items];
  if (index >= 0 && index < result.length && target >= 0 && target < result.length) [result[index], result[target]] = [result[target], result[index]];
  return result;
}
export function moveSection(document: ResumeDocument, title: string, delta: -1 | 1) {
  const entries = Object.entries(document.cv.sections ?? {});
  return { ...document, cv: { ...document.cv, sections: Object.fromEntries(moveItem(entries, entries.findIndex(([key]) => key === title), delta)) } };
}
export const entryText = (entry: ResumeEntry) => typeof entry === "string" ? entry : Object.values(entry).flatMap(v => Array.isArray(v) ? v : [v]).filter(v => v != null).join(" · ");
