import { ApiError } from "../../services/api.ts";
import schema from "./rendercv-2.8.schema.json" with { type: "json" };
import type { ResumeDocument } from "./types.ts";
const keys = new Set("occupation_code skill_filter_version source_sections source_projects heading_fact_id polishable_fact_ids project_id highlights highlight_fact_ids patches fact_id document job_requirements skills evidence evidence_reviewed id text entries gaps skill_ids fact_ids keywords skill_slugs course_id gap_ids reason courses field instruction context_reviewed history role content section_index source_ids path value design".split(" "));
function collect(value: unknown) {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && "properties" in value && value.properties && typeof value.properties === "object") for (const key of Object.keys(value.properties)) keys.add(key);
  for (const child of Object.values(value)) collect(child);
}
collect(schema);
const label = (key: string) => keys.has(key) ? key.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()) : "Field";
export function resumeErrorMessage(cause: unknown, document?: ResumeDocument): string {
  let message = cause instanceof Error ? cause.message : "Something went wrong. Your local draft is unchanged.";
  if (!(cause instanceof ApiError) || !cause.fields.length) return message;
  if (cause.code === "render_values_invalid") message = "Some resume fields need attention.";
  const locations = cause.fields.map(path => {
    if (path[0] === "document") path = path.slice(1);
    const parts: string[] = [];
    for (let i = 0; i < path.length; i++) {
      const part = path[i];
      if (i === 2 && path[0] === "cv" && path[1] === "sections" && typeof part === "number") {
        parts.push(Object.keys(document?.cv.sections ?? {})[part] ?? `Section ${part + 1}`);
      } else if (typeof part === "number") {
        parts.push(`${(i === 3 && path[1] === "sections") || path[i - 1] === "entries" ? "Entry" : path[i - 1] === "sections" ? "Generated section" : "Item"} ${part + 1}`);
      } else if (part !== "cv") parts.push(label(part));
    }
    return parts.length ? parts.join(" → ") : "YAML document";
  });
  return `${message} Check: ${[...new Set(locations)].join("; ")}.`;
}
