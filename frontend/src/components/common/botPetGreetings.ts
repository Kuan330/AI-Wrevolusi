/** Page keys for BotPet entry greetings. */
export type BotPetPage = "plan" | "learning" | "possibilities";

/** Action-driven tips (shuffle bag per action). */
export type BotPetAction =
  | "add-skill-chip"
  | "plan-record"
  | "save-progress"
  | "remove-item"
  | "add-course";

type TimeSlot = "morning" | "afternoon" | "evening" | "night";

/** Time-of-day openers (local browser hour). */
const TIME_OPENERS: Record<TimeSlot, string> = {
  morning: "Morning!",
  afternoon: "Afternoon —",
  evening: "Evening wind-down.",
  night: "Late one!",
};

/** Page context lines — short enough for the cloud bubble. */
const CONTEXT_POOLS: Record<BotPetPage, readonly string[]> = {
  plan: [
    "Back for one small step?",
    "A little progress beats a perfect plan.",
    "Ready to tick off another chapter?",
    "Keep the streak alive, I believe in you.",
  ],
  learning: [
    "Found something worth learning yet?",
    "New skill, unlocked. Let's go.",
    "Pick one, you can always switch.",
    "Your skills want an upgrade.",
  ],
  possibilities: [
    "Let's see where your strengths lead.",
    "What's got you curious today?",
    "Your next step is hiding in here.",
    "Open a card and see what fits.",
  ],
};

/** Tips after a concrete user action succeeds. */
const ACTION_POOLS: Record<BotPetAction, readonly string[]> = {
  "add-skill-chip": [
    "Nice pick that direction suits you.",
    "Added! Your learning list is growing.",
    "Good eye. One more?",
    "Locked in. What's next?",
  ],
  "plan-record": [
    "Logged — small step, big streak.",
    "Recorded. You showed up today.",
    "Nice. Come back tomorrow?",
    "Done. That's how habits are built.",
  ],
  "save-progress": [
    "Progress saved. Keep climbing.",
    "Chapter updated, you're getting there.",
  ],
  "remove-item": ["No worries! Make room for what fits."],
  "add-course": [
    "Added to your plan. Nice.",
    "Course saved, see you in My Plan.",
  ],
};

const BAG_STORAGE_KEY = "aiwrevolusi.botPetGreetings.v2";

type BagKey = BotPetPage | BotPetAction;
type BagStore = Partial<Record<BagKey, string[]>>;

export function timeSlot(hour = new Date().getHours()): TimeSlot {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function shuffle(items: string[]): string[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const left = next[i]!;
    next[i] = next[j]!;
    next[j] = left;
  }
  return next;
}

function readBags(): BagStore {
  try {
    const raw = localStorage.getItem(BAG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BagStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeBags(bags: BagStore) {
  try {
    localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(bags));
  } catch {
    /* Greeting bags are optional when storage is blocked. */
  }
}

function pickFromPool(key: BagKey, pool: readonly string[]): string {
  const bags = readBags();
  let remaining = bags[key]?.filter((line) => pool.includes(line)) ?? [];
  if (!remaining.length) remaining = shuffle([...pool]);
  const [picked, ...rest] = remaining;
  bags[key] = rest;
  writeBags(bags);
  return picked ?? pool[0]!;
}

/** Draw one context line without replacement; refill when the bag is empty. */
export function pickContextLine(page: BotPetPage): string {
  return pickFromPool(page, CONTEXT_POOLS[page]);
}

/** Draw one action tip without replacement. */
export function pickActionLine(action: BotPetAction): string {
  return pickFromPool(action, ACTION_POOLS[action]);
}

/** Time opener + page context for a BotPet entry bubble. */
export function composeGreeting(page: BotPetPage): string {
  return `${TIME_OPENERS[timeSlot()]} ${pickContextLine(page)}`;
}
