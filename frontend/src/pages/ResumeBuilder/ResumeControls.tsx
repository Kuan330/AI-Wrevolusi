import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input, NativeSelect } from "@/components/ui/form-field";
import { controlFields, controls, fieldLabel, updateControl, type ControlField } from "@/features/resume/editorModel";
import { THEMES } from "@/features/resume/document";
import type { ResumeDocument } from "@/features/resume/types";
import { ValueField, type DocumentChange } from "./ResumeForm";
const dimension = /^(-?\d*(?:\.\d*)?)(cm|mm|in|pt|em|ex|px)$/;
function hexColor(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) return "#" + value.slice(1).split("").map(c => c + c).join("");
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(value);
  return rgb ? "#" + rgb.slice(1).map(part => Number(part).toString(16).padStart(2, "0")).join("") : "#000000";
}
function Control({ field, change }: { field: ControlField; change: (value: unknown, key?: string | null) => void }) {
  const key = field.path.join("."), value = field.value, label = `${field.label} · ${key}`;
  const size = typeof value === "string" ? dimension.exec(value) : null;
  if (Array.isArray(value)) return <ValueField name={field.path.at(-1)!} path={key} value={value} markdown={false} fixed={field.path.at(-1)?.startsWith("month_")} change={change} />;
  if (typeof value === "boolean") return <div className="rw-field-row"><span>{field.label}</span><Checkbox aria-label={label} checked={value} onCheckedChange={next => change(next === true, null)} /></div>;
  return <div className="rw-field-row"><FormField label={field.label}>{field.options.length ? <NativeSelect aria-label={label} value={String(value ?? "")} onChange={event => change(event.target.value, null)}>{!field.options.includes(String(value ?? "")) && <option value={String(value ?? "")}>{String(value)}</option>}{field.options.map(option => <option value={option} key={option}>{fieldLabel(option)}</option>)}</NativeSelect> : size ? <div className="rw-dimension"><Input aria-label={label} type="number" step="any" value={size[1]} onChange={event => change(event.target.value + size[2], key)} /><NativeSelect aria-label={`Unit · ${key}`} value={size[2]} onChange={event => change(size[1] + event.target.value, null)}>{["cm", "mm", "in", "pt", "em", "ex", "px"].map(unit => <option key={unit}>{unit}</option>)}</NativeSelect></div> : field.path[0] === "colors" ? <div className="rw-color"><Input type="color" aria-label={`Pick color · ${key}`} value={hexColor(String(value))} onChange={event => change(event.target.value, key)} /><Input aria-label={label} value={String(value ?? "")} onChange={event => change(event.target.value, key)} /></div> : <Input aria-label={label} value={String(value ?? "")} onChange={event => change(event.target.value, key)} />}</FormField></div>;
}
export default function ResumeControls({ document, section, change }: { document: ResumeDocument; section: "design" | "locale" | "settings"; change: DocumentChange }) {
  const fields = controlFields(document, section);
  const groups = [...new Set(fields.map(field => field.path.length > 1 ? field.path.slice(0, -1).join(" / ") : "General"))];
  const theme = String(document.design?.theme ?? "classic"), index = THEMES.indexOf(theme as typeof THEMES[number]);
  const setTheme = (value: string) => change({ ...document, design: { ...document.design, theme: value } }, null);
  return <div className="rw-control-form">
    {section === "design" && <div className="rw-theme-picker"><Button variant="ghost" size="sm" aria-label="Previous theme" onClick={() => setTheme(THEMES[(index + THEMES.length - 1) % THEMES.length])}>‹</Button><FormField label="Theme"><NativeSelect aria-label="Theme" value={theme} onChange={event => setTheme(event.target.value)}>{THEMES.map(name => <option value={name} key={name}>{fieldLabel(name)}</option>)}</NativeSelect></FormField><Button variant="ghost" size="sm" aria-label="Next theme" onClick={() => setTheme(THEMES[(index + 1) % THEMES.length])}>›</Button></div>}
    {section === "locale" && <div className="rw-field-row"><FormField label="Language"><NativeSelect aria-label="Locale language" value={String(document.locale?.language ?? "english")} onChange={event => change({ ...document, locale: { ...document.locale, language: event.target.value } }, null)}>{Object.keys(controls.locales).map(name => <option value={name} key={name}>{fieldLabel(name)}</option>)}</NativeSelect></FormField></div>}
    {groups.map(group => <section className="rw-control-group" key={group}><h3>{fieldLabel(group)}</h3>{fields.filter(field => (field.path.length > 1 ? field.path.slice(0, -1).join(" / ") : "General") === group).map(field => <Control key={field.path.join(".")} field={field} change={(value, key) => change(updateControl(document, section, field.path, value), key ? `${section}.${key}` : null)} />)}</section>)}
  </div>;
}
