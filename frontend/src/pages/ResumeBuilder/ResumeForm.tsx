import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, Input, NativeSelect, Textarea } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { moveItem, type THEMES } from "@/features/resume/document";
import type { ResumeDocument, ResumeEntry } from "@/features/resume/types";
import { useState } from "react";

const label = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
/** Nested fields remain intact: arrays, social links, publications and design mappings round-trip. */
function ValueField({ name, value, change }: { name: string; value: unknown; change: (value: unknown) => void }) {
  if (typeof value === "boolean") return <label className="rb-check"><Checkbox checked={value} onCheckedChange={checked => change(checked === true)} />{label(name)}</label>;
  if (Array.isArray(value) && value.every(item => typeof item === "string")) return <FormField label={label(name)} hint="One item per line"><Textarea value={value.join("\n")} onChange={event => change(event.target.value.split("\n"))} /></FormField>;
  if (Array.isArray(value)) return <div className="rb-nested"><strong>{label(name)}</strong>{value.map((item, i) => <div key={i}><ValueField name={`${name} ${i + 1}`} value={item} change={next => change(value.map((old, j) => i === j ? next : old))} /><Button variant="ghost" size="sm" onClick={() => change(value.filter((_, j) => j !== i))}>Remove {label(name)} {i + 1}</Button></div>)}<Button variant="outline" size="sm" onClick={() => change([...value, typeof value[0] === "object" ? Object.fromEntries(Object.keys(value[0] as object).map(key => [key, ""])) : ""])}>Add {label(name)}</Button></div>;
  if (value && typeof value === "object") return <div className="rb-nested"><strong>{label(name)}</strong>{Object.entries(value).map(([key, item]) => <ValueField key={key} name={key} value={item} change={next => change({ ...value, [key]: next })} />)}</div>;
  if (typeof value === "number") return <FormField label={label(name)}><Input type="number" value={value} onChange={event => change(Number(event.target.value))} /></FormField>;
  const long = ["bullet", "number", "reversed_number", "details", "summary", "text"].includes(name);
  return <FormField label={label(name)}>{long ? <Textarea value={String(value ?? "")} onChange={event => change(event.target.value)} /> : <Input value={String(value ?? "")} onChange={event => change(event.target.value)} />}</FormField>;
}
const ENTRY_TYPES: Record<string, ResumeEntry> = {
  Bullet: { bullet: "" }, Text: "", "One line": { label: "", details: "" },
  Experience: { company: "", position: "" }, Education: { institution: "", area: "" },
  Project: { name: "" }, Publication: { title: "", authors: [] },
  Numbered: { number: "" }, "Reversed numbered": { reversed_number: "" },
};
const fieldsFor = (entry: ResumeEntry) => {
  if (typeof entry === "string") return [];
  if ("company" in entry || "institution" in entry || "name" in entry) return ["date", "start_date", "end_date", "location", "summary", "highlights", ...("institution" in entry ? ["degree"] : [])];
  if ("authors" in entry) return ["date", "doi", "url", "journal", "summary"];
  return [];
};
function inferType(entry?: ResumeEntry) {
  if (typeof entry === "string") return "Text";
  if (!entry) return "Bullet";
  return Object.entries(ENTRY_TYPES).find(([, sample]) => typeof sample === "object" && Object.keys(sample).every(key => key in entry))?.[0] ?? "Bullet";
}
export function ResumeForm({ document, selected, change, remove }: { document: ResumeDocument; selected: string; change: (document: ResumeDocument) => void; remove: (title: string) => void }) {
  const sections = document.cv.sections ?? {};
  const entries = sections[selected] ?? [];
  const [newType, setNewType] = useState("Bullet");
  const [newTitle, setNewTitle] = useState("");
  const [formError, setFormError] = useState("");
  const replace = (next: ResumeEntry[]) => change({ ...document, cv: { ...document.cv, sections: { ...sections, [selected]: next } } });
  if (selected === "@personal") return <div className="rb-form"><h2>Personal information</h2><p>Only enter facts you want in your resume. These fields stay out of AI requests.</p>{["name", "headline", "email", "phone", "location", "website"].map(key => <ValueField key={key} name={key} value={document.cv[key] ?? ""} change={value => {
    const cv = { ...document.cv }; if (!value) delete cv[key]; else cv[key] = value; change({ ...document, cv });
  }} />)}{Object.entries(document.cv).filter(([key]) => !["name", "headline", "email", "phone", "location", "website", "sections", "photo"].includes(key)).map(([key, value]) => <ValueField key={key} name={key} value={value} change={next => change({ ...document, cv: { ...document.cv, [key]: next } })} />)}<Button variant="outline" onClick={() => change({ ...document, cv: { ...document.cv, social_networks: [...((document.cv.social_networks as unknown[]) ?? []), { network: "LinkedIn", username: "" }] } })}>Add social link</Button></div>;
  if (!Object.hasOwn(sections, selected)) return <div className="rb-form"><h2>Select a chapter</h2><p>Add your own information, or choose a generated section.</p></div>;
  return <div className="rb-form"><div className="rb-section-title"><h2>{selected}</h2><Button variant="ghost" size="icon" aria-label={`Delete ${selected} section`} onClick={() => remove(selected)}><Trash2 /></Button></div>
    <div className="rb-inline"><Input aria-label="New section title" value={newTitle} placeholder="Rename this section" onChange={event => setNewTitle(event.target.value)} maxLength={100} /><Button variant="outline" size="sm" onClick={() => {
      const title = newTitle.trim(); if (!title || title.startsWith("@") || Object.hasOwn(sections, title) || ["__proto__", "constructor", "prototype"].includes(title)) { setFormError("Choose a unique section title."); return; }
      change({ ...document, cv: { ...document.cv, sections: Object.fromEntries(Object.entries(sections).map(([key, items]) => [key === selected ? title : key, items])) } }); setNewTitle(""); setFormError("");
    }}>Rename</Button></div>
    {formError && <p role="alert" className="rb-error">{formError}</p>}
    {entries.map((entry, index) => <div className="rb-entry" key={index}><div className="rb-entry-tools"><span>Entry {index + 1}</span><div><Button variant="ghost" size="icon" aria-label={`Move entry ${index + 1} up`} disabled={index === 0} onClick={() => replace(moveItem(entries, index, -1))}><ArrowUp /></Button><Button variant="ghost" size="icon" aria-label={`Move entry ${index + 1} down`} disabled={index === entries.length - 1} onClick={() => replace(moveItem(entries, index, 1))}><ArrowDown /></Button><Button variant="ghost" size="icon" aria-label={`Remove entry ${index + 1}`} onClick={() => replace(entries.filter((_, i) => i !== index))}><Trash2 /></Button></div></div>
      {typeof entry === "string" ? <ValueField name="text" value={entry} change={next => replace(entries.map((old, i) => i === index ? String(next) : old))} /> : <>
        {Object.entries(entry).map(([key, value]) => <div className="rb-entry-field" key={key}><ValueField name={key} value={value} change={next => replace(entries.map((old, i) => i === index ? { ...entry, [key]: next } : old))} />{fieldsFor(entry).includes(key) && <Button variant="ghost" size="sm" onClick={() => { const next = { ...entry }; delete next[key]; replace(entries.map((old, i) => i === index ? next : old)); }}>Remove {label(key)}</Button>}</div>)}
        {fieldsFor(entry).filter(key => !Object.hasOwn(entry, key)).length > 0 && <NativeSelect aria-label={`Add a field to entry ${index + 1}`} value="" onChange={event => { const key = event.target.value; if (key) replace(entries.map((old, i) => i === index ? { ...entry, [key]: key === "highlights" ? [] : "" } : old)); }}><option value="">Add an optional field…</option>{fieldsFor(entry).filter(key => !Object.hasOwn(entry, key)).map(key => <option key={key} value={key}>{label(key)}</option>)}</NativeSelect>}
      </>}
    </div>)}
    <div className="rb-inline"><NativeSelect aria-label="Entry type" value={entries.length ? inferType(entries[0]) : newType} disabled={entries.length > 0} onChange={event => setNewType(event.target.value)}>{Object.keys(ENTRY_TYPES).map(type => <option key={type}>{type}</option>)}</NativeSelect><Button variant="outline" onClick={() => replace([...entries, structuredClone(ENTRY_TYPES[entries.length ? inferType(entries[0]) : newType])])}><Plus />Add entry</Button></div>
  </div>;
}
function designValue(document: ResumeDocument, group: string, key: string, fallback: string) {
  return String((document.design?.[group] as Record<string, unknown> | undefined)?.[key] ?? fallback);
}
export function DesignControls({ document, themes, change }: { document: ResumeDocument; themes: typeof THEMES; change: (next: ResumeDocument) => void }) {
  const set = (group: string, key: string, value: unknown) => change({ ...document, design: { ...document.design, [group]: { ...(document.design?.[group] as object), [key]: value } } });
  const typography = (key: string, value: unknown) => set("typography", key, value);
  const fontSize = (document.design?.typography as Record<string, unknown> | undefined)?.font_size as Record<string, unknown> | undefined;
  const font = (document.design?.typography as Record<string, unknown> | undefined)?.font_family;
  return <div className="rb-design"><FormField label="Template"><NativeSelect value={String(document.design?.theme ?? "classic")} onChange={event => change({ ...document, design: { ...document.design, theme: event.target.value } })}>{themes.map(theme => <option value={theme} key={theme}>{theme === "engineeringresumes" ? "Engineering Resumes" : theme === "engineeringclassic" ? "Engineering Classic" : theme.charAt(0).toUpperCase() + theme.slice(1)}</option>)}</NativeSelect></FormField>
    <FormField label="Font family"><NativeSelect value={typeof font === "string" ? font : String((font as Record<string, unknown> | undefined)?.body ?? "Source Sans 3")} onChange={event => typography("font_family", typeof font === "object" ? { ...font, body: event.target.value } : event.target.value)}>{["Source Sans 3", "Source Serif 4", "Roboto", "Lato", "Ubuntu", "Libertinus Serif"].map(name => <option key={name}>{name}</option>)}</NativeSelect></FormField>
    <FormField label="Body font size"><Input value={String(fontSize?.body ?? "10pt")} onChange={event => typography("font_size", { ...fontSize, body: event.target.value })} /></FormField>
    <FormField label="Line spacing"><Input value={designValue(document, "typography", "line_spacing", "0.6em")} onChange={event => typography("line_spacing", event.target.value)} /></FormField>
    <FormField label="Accent colour"><Input type="color" value={designValue(document, "colors", "section_titles", "#287496")} onChange={event => set("colors", "section_titles", event.target.value)} /></FormField>
    <FormField label="Paper size"><NativeSelect value={designValue(document, "page", "size", "a4")} onChange={event => set("page", "size", event.target.value)}><option value="a4">A4</option><option value="us-letter">US Letter</option></NativeSelect></FormField>
    {["top_margin", "bottom_margin", "left_margin", "right_margin"].map(key => <FormField label={label(key)} key={key}><Input value={designValue(document, "page", key, "1.5cm")} onChange={event => set("page", key, event.target.value)} /></FormField>)}
    <p className="rb-hint">Use YAML for all additional safe RenderCV styling options. Custom code, photos and external file paths are not supported.</p>
  </div>;
}
