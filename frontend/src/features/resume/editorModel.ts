import schema from "./rendercv-2.8.schema.json" with { type: "json" };
import exported from "./rendercv-2.8.controls.json" with { type: "json" };
import type { ResumeDocument, ResumeEntry } from "./types.ts";
export type Mapping = Record<string, unknown>;
type SchemaNode = { $ref?: string; properties?: Record<string, SchemaNode>; anyOf?: SchemaNode[]; oneOf?: SchemaNode[]; enum?: unknown[]; const?: unknown; items?: SchemaNode; type?: string; minimum?: number; maximum?: number };
export const networkOptions = ((schema.$defs.SocialNetworkName as { enum: string[] }).enum);
export const controls = exported as { version: string; themes: Record<string, Mapping>; locales: Record<string, Mapping>; settings: Mapping; definitions: { themes: Record<string, string>; locales: Record<string, string> } };
const definitions = schema.$defs as Record<string, SchemaNode>;
export const fieldLabel = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
export const isMapping = (value: unknown): value is Mapping => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function resolveSchema(node: SchemaNode = {}): SchemaNode {
  if (node.$ref) return resolveSchema(definitions[node.$ref.split("/").at(-1)!]);
  const object = [...(node.anyOf ?? []), ...(node.oneOf ?? [])].map(resolveSchema).find(value => value.properties);
  return object ?? node;
}
export function schemaOptions(node: SchemaNode = {}): string[] {
  const resolved = resolveSchema(node);
  return [...new Set([...(resolved.enum ?? []).filter((value): value is string => typeof value === "string"),
    ...[...(resolved.anyOf ?? []), ...(resolved.oneOf ?? [])].flatMap(schemaOptions)])];
}
export function effectiveMerge(base: unknown, override: unknown): unknown {
  if (!isMapping(base)) return override === undefined ? structuredClone(base) : structuredClone(override);
  if (override !== undefined && !isMapping(override)) {
    return Object.fromEntries(Object.entries(base).map(([key, item]) => [key, effectiveMerge(item, override)]));
  }
  const given = isMapping(override) ? override : {};
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(given)])].map(key => [key, effectiveMerge(base[key], given[key])]));
}
export function controlDefaults(document: ResumeDocument, section: "design" | "locale" | "settings"): Mapping {
  if (section === "settings") return controls.settings;
  if (section === "locale") return controls.locales[String(document.locale?.language ?? "english")] ?? controls.locales.english;
  return controls.themes[String(document.design?.theme ?? "classic")] ?? controls.themes.classic;
}
export type ControlField = { path: string[]; label: string; value: unknown; options: string[]; schema: SchemaNode };
export function controlFields(document: ResumeDocument, section: "design" | "locale" | "settings"): ControlField[] {
  const defaults = controlDefaults(document, section);
  const rootSchema = section === "settings" ? definitions.Settings : section === "design" ? definitions[controls.definitions.themes[String(defaults.theme)]] : definitions[controls.definitions.locales[String(defaults.language)]];
  const values = effectiveMerge(defaults, document[section]) as Mapping, fields: ControlField[] = [];
  const visit = (base: Mapping, effective: Mapping, node: SchemaNode, path: string[]) => {
    for (const [key, fallback] of Object.entries(base)) {
      if (key === "theme" || key === "language" || key.startsWith("photo") || ["templates", "render_command"].includes(key) || (path.join(".") === "header.connections" && key === "phone_number_format")) continue;
      const property = resolveSchema(node).properties?.[key] ?? {};
      const next = [...path, key];
      if (isMapping(fallback)) visit(fallback, effective[key] as Mapping, property, next);
      else fields.push({ path: next, label: fieldLabel(key), value: effective[key], options: schemaOptions(property), schema: property });
    }
  };
  visit(defaults, values, rootSchema ?? {}, []);
  return fields;
}
export function updateControl(document: ResumeDocument, section: "design" | "locale" | "settings", path: string[], value: unknown): ResumeDocument {
  const result = structuredClone(document);
  const effective = effectiveMerge(controlDefaults(document, section), document[section]) as Mapping;
  const root = { ...document[section] }; result[section] = root;
  let node = root, resolved = effective;
  for (const key of path.slice(0, -1)) {
    node[key] = isMapping(node[key]) ? { ...node[key] } : node[key] !== undefined && isMapping(resolved[key]) ? structuredClone(resolved[key]) : {};
    node = node[key] as Mapping; resolved = resolved[key] as Mapping;
  }
  node[path.at(-1)!] = value;
  return result;
}
export const ENTRY_TYPES: Record<string, ResumeEntry> = {
  Bullet: { bullet: "" }, Text: "", "One line": { label: "", details: "" },
  Experience: { company: "", position: "" }, Education: { institution: "", area: "" },
  Project: { name: "" }, Publication: { title: "", authors: [] },
  Numbered: { number: "" }, "Reversed numbered": { reversed_number: "" },
};
export function entryType(entry: ResumeEntry): string {
  if (typeof entry === "string") return "Text";
  return Object.entries(ENTRY_TYPES).find(([, sample]) => isMapping(sample) && Object.keys(sample).every(key => key in entry))?.[0] ?? "Bullet";
}
export function entryFields(entry: ResumeEntry): string[] {
  if (typeof entry === "string") return [];
  const base = Object.keys(ENTRY_TYPES[entryType(entry)] as Mapping);
  const optional = "company" in entry || "institution" in entry || "name" in entry ? ["date", "start_date", "end_date", "location", "summary", "highlights", ...("institution" in entry ? ["degree"] : [])] : "authors" in entry ? ["date", "doi", "url", "journal", "summary"] : [];
  return [...new Set([...base, ...optional, ...Object.keys(entry)])];
}
export function renameSection(document: ResumeDocument, oldTitle: string, nextTitle: string): ResumeDocument {
  const title = nextTitle.trim();
  if (!title || title.length > 100 || title.startsWith("@") || ["__proto__", "constructor", "prototype"].includes(title) || (title !== oldTitle && Object.hasOwn(document.cv.sections ?? {}, title))) throw new Error("Choose a unique chapter title of 1–100 characters.");
  return { ...document, cv: { ...document.cv, sections: Object.fromEntries(Object.entries(document.cv.sections ?? {}).map(([key, entries]) => [key === oldTitle ? title : key, entries])) } };
}
export function formatSelection(text: string, start: number, end: number, kind: "bold" | "italic" | "link", url = "") {
  if (kind === "link" && !/^(?:https?:\/\/|mailto:|tel:)[^\s<>"()]+$/i.test(url)) throw new Error("Use an https, http, mailto or tel link.");
  const before = kind === "bold" ? "**" : kind === "italic" ? "*" : "[";
  const after = kind === "link" ? `](${url})` : before;
  return { text: text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end), start: start + before.length, end: end + before.length };
}
