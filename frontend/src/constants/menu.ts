import { ROUTES } from "@/constants/routes";

export type JourneyArea = "work" | "learning" | "careers";

type JourneyMenuItem = {
  key: JourneyArea;
  label: string;
  path: string;
  paths: readonly string[];
};

/** Areas stay in the same order before and after work confirmation. */
export const PRIMARY_NAV_MENU: readonly JourneyMenuItem[] = [
  {
    key: "work",
    label: "My Work",
    path: ROUTES.workProfile,
    paths: [ROUTES.workProfile, ROUTES.aiExposure, ROUTES.skills, "/work-profile"],
  },
  {
    key: "learning",
    label: "My Learning",
    path: ROUTES.plan,
    paths: [ROUTES.plan, ROUTES.learningCentre],
  },
  {
    key: "careers",
    label: "Career Options",
    path: ROUTES.possibilities,
    paths: [ROUTES.possibilities],
  },
];

export const WORK_NAV_MENU = [
  { key: "details", label: "Work details", path: ROUTES.workProfile },
  { key: "tasks", label: "My tasks", path: ROUTES.task },
  { key: "findings", label: "AI findings", path: ROUTES.aiExposure },
  { key: "skills", label: "My skills", path: ROUTES.skills },
] as const;

export const LEARNING_NAV_MENU = [
  { key: "plan", label: "My learning", path: ROUTES.plan },
  { key: "resources", label: "Find learning", path: ROUTES.learningCentre },
] as const;

export function getJourneyArea(pathname: string): JourneyArea | undefined {
  return PRIMARY_NAV_MENU.find((item) =>
    item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  )?.key;
}

export type WorkNavigationState = {
  workConfirmed: boolean;
  assessmentChecked: boolean;
  skillsReviewed: boolean;
};

/** Status describes saved decisions, never a page visit or a reliable score. */
export function getWorkStepStatus(
  key: (typeof WORK_NAV_MENU)[number]["key"],
  state: WorkNavigationState,
): string | undefined {
  if ((key === "details" || key === "tasks") && state.workConfirmed) {
    return "Confirmed";
  }
  if (key === "findings" && state.assessmentChecked) return "Checked";
  if (key === "skills" && state.skillsReviewed) return "Reviewed";
  return undefined;
}
