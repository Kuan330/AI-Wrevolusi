import type { ExperienceLevel, LearningGoalKind, LearningPlanInputs, MinutesPerDay } from "./personalLearningPlan.ts";

export type LearningPlanResource = {
  id: string;
  kind: "file" | "link";
  name: string;
  url?: string;
  text?: string;
  sizeBytes?: number;
};
export type LearningPlanSetupDraft = {
  goalText: string;
  experience: ExperienceLevel | "";
  minutesPerDay: MinutesPerDay | "";
  goalKind: LearningGoalKind | "";
};
export const MAX_PLAN_RESOURCES = 5;
export const MAX_RESOURCE_BYTES = 1024 * 1024;
export const MAX_RESOURCE_TEXT = 20_000;
export const MAX_TOTAL_RESOURCE_TEXT = 50_000;
export const RESOURCE_ACCEPT = ".txt,.md,.csv,text/plain,text/markdown,text/csv";

export function validateSetupDraft(draft: LearningPlanSetupDraft): string {
  if (!draft.goalText.trim()) return "Tell us what you want to learn.";
  if (draft.goalText.trim().length > 300) return "Keep your learning goal to 300 characters or fewer.";
  if (!["new", "some", "comfortable"].includes(draft.experience)) return "Choose your starting level.";
  if (![15, 30, 45, 60, 90].includes(Number(draft.minutesPerDay))) return "Choose how much time you can give it each day.";
  if (draft.goalKind && !["career", "skill", "confidence", "curiosity"].includes(draft.goalKind)) return "Choose a supported reason for learning.";
  return "";
}

export function setupInputs(draft: LearningPlanSetupDraft): LearningPlanInputs {
  const error = validateSetupDraft(draft);
  if (error) throw new Error(error);
  return {
    goalText: draft.goalText.trim(),
    experience: draft.experience as ExperienceLevel,
    minutesPerDay: draft.minutesPerDay as MinutesPerDay,
    goalKind: draft.goalKind || "curiosity",
  };
}

export function normalizeResourceUrl(value: string): string {
  const input = value.trim();
  if (input.length > 2048) throw new Error("Keep the link to 2,048 characters or fewer.");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Enter a complete link beginning with https:// or http://."); }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Use an http:// or https:// link without embedded login details.");
  }
  // Links are references only: never fetch user-supplied URLs in this form.
  url.hash = "";
  return url.href;
}

export function validateResourceFile(file: { name: string; size: number }): string {
  if (!/\.(txt|md|csv)$/i.test(file.name)) return "Choose a TXT, Markdown or CSV file. Other formats are not supported yet.";
  if (!Number.isFinite(file.size) || file.size <= 0) return "This file is empty. Choose a file with some content.";
  if (file.size > MAX_RESOURCE_BYTES) return "Choose a file no larger than 1 MB.";
  return "";
}

export function validateResourceText(text: string): string {
  if (!text.trim()) return "This file has no readable text.";
  if (text.includes("\u0000") || text.includes("\uFFFD")) return "Choose a readable UTF-8 text file.";
  if (text.length > MAX_RESOURCE_TEXT) return "This file is too long. Use an excerpt of 20,000 characters or fewer.";
  return "";
}

export function addPlanResource(resources: LearningPlanResource[], resource: LearningPlanResource): LearningPlanResource[] {
  if (!resource.id || !resource.name.trim()) throw new Error("This resource is missing a name or identifier.");
  if (resources.length >= MAX_PLAN_RESOURCES) throw new Error("You can attach up to 5 resources. Remove one before adding another.");
  if (resource.kind === "link") {
    const url = normalizeResourceUrl(resource.url ?? "");
    if (resources.some(item => item.kind === "link" && item.url === url)) throw new Error("This link is already attached.");
    return [...resources, { id: resource.id, kind: "link", name: new URL(url).hostname, url }];
  }
  if (resource.kind !== "file") throw new Error("This resource type is not supported.");
  const fileError = validateResourceFile({ name: resource.name, size: resource.sizeBytes ?? 0 });
  const textError = validateResourceText(resource.text ?? "");
  if (fileError || textError) throw new Error(fileError || textError);
  if (resources.some(item => item.kind === "file" && item.name === resource.name && item.text === resource.text)) throw new Error("This file is already attached.");
  if (resources.reduce((sum, item) => sum + (item.text?.length ?? 0), 0) + (resource.text?.length ?? 0) > MAX_TOTAL_RESOURCE_TEXT) {
    throw new Error("Your files exceed 50,000 characters in total. Remove a file or use shorter excerpts.");
  }
  return [...resources, { id: resource.id, kind: "file", name: resource.name, sizeBytes: resource.sizeBytes, text: resource.text }];
}
