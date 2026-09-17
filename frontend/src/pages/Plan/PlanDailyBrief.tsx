import type { DailyBriefResponse } from "@/services/learningService";

export type BriefTourStep = {
  text: string;
  /** Last step can offer an explicit check-in action. */
  action?: "checkin";
  /** Bubble width hint — longer copy gets a wider cloud. */
  widthRem: number;
};

const BRIEF_TOUR_SEEN_KEY = "aiwrevolusi.planBriefTourSeen.v1";

/** ~3 lines at the wider bubble; overflow becomes another Next step. */
const MAX_CHARS_PER_STEP = 108;

export function briefTourStorageKey(brief: DailyBriefResponse) {
  return `${brief.local_date}:${brief.variant}`;
}

export function hasSeenBriefTour(key: string): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(BRIEF_TOUR_SEEN_KEY) ?? "{}") as
      | Record<string, boolean>
      | null;
    return Boolean(raw && raw[key]);
  } catch {
    return false;
  }
}

export function markBriefTourSeen(key: string) {
  try {
    const raw = (JSON.parse(localStorage.getItem(BRIEF_TOUR_SEEN_KEY) ?? "{}") ??
      {}) as Record<string, boolean>;
    raw[key] = true;
    const keys = Object.keys(raw);
    if (keys.length > 20) {
      for (const old of keys.slice(0, keys.length - 20)) delete raw[old];
    }
    localStorage.setItem(BRIEF_TOUR_SEEN_KEY, JSON.stringify(raw));
  } catch {
    /* Tour memory is optional. */
  }
}

/** Pick a bubble width from copy length (slightly longer for denser steps). */
export function speechWidthRem(text: string): number {
  const n = text.replace(/\s+/g, " ").trim().length;
  if (n <= 42) return 12.5;
  if (n <= 72) return 14.5;
  if (n <= 96) return 16.5;
  return 18;
}

/** Keep every word; split long copy across extra Next pages. */
function chunkForBubble(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= MAX_CHARS_PER_STEP) return [cleaned];

  const chunks: string[] = [];
  let rest = cleaned;
  while (rest.length > MAX_CHARS_PER_STEP) {
    const window = rest.slice(0, MAX_CHARS_PER_STEP + 1);
    let cut = window.lastIndexOf(". ");
    if (cut < MAX_CHARS_PER_STEP * 0.4) cut = window.lastIndexOf("! ");
    if (cut < MAX_CHARS_PER_STEP * 0.4) cut = window.lastIndexOf("? ");
    if (cut < MAX_CHARS_PER_STEP * 0.4) cut = window.lastIndexOf("; ");
    if (cut < MAX_CHARS_PER_STEP * 0.4) cut = window.lastIndexOf(", ");
    if (cut < MAX_CHARS_PER_STEP * 0.4) cut = window.lastIndexOf(" ");
    if (cut < MAX_CHARS_PER_STEP * 0.4) cut = MAX_CHARS_PER_STEP;
    else if (".!?;,".includes(rest[cut] ?? "")) cut += 1;

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function pushChunked(
  steps: BriefTourStep[],
  text: string,
  action?: BriefTourStep["action"],
) {
  const parts = chunkForBubble(text);
  parts.forEach((part, index) => {
    steps.push({
      text: part,
      widthRem: speechWidthRem(part),
      action: index === parts.length - 1 ? action : undefined,
    });
  });
}

/** Split the server daily-brief into short BotPet speech pages (≤3 lines each). */
export function buildBriefTourSteps(brief: DailyBriefResponse): BriefTourStep[] {
  const steps: BriefTourStep[] = [];

  pushChunked(steps, brief.greeting);
  pushChunked(steps, brief.summary);

  for (const rec of brief.recommendations) {
    const pct = Math.round(rec.progress * 100);
    pushChunked(steps, `${rec.skill_name} · ${pct}%`);
    pushChunked(steps, rec.reason);
  }

  if (brief.closing.trim()) {
    pushChunked(steps, brief.closing);
  }

  if (!brief.checked_in_today) {
    pushChunked(
      steps,
      "When you are ready, check in to keep your streak going.",
      "checkin",
    );
  } else {
    pushChunked(
      steps,
      `Checked in · ${brief.streak_days} day streak. Nice work.`,
    );
  }

  return steps;
}
