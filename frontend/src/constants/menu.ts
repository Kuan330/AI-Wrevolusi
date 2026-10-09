import { ROUTES } from "./routes.ts";

export const SIDEBAR_GROUPS = [
  { key: "overview", label: "Overview", collapsible: false, icon: "dashboard", items: [
    { label: "Overview", path: ROUTES.dashboard, icon: "dashboard", exact: true },
  ] },
  { key: "work", label: "My work & AI", collapsible: true, icon: "work", items: [
    { label: "My work", path: ROUTES.workProfile, icon: "work", exact: true },
    { label: "AI impact & assistance", path: ROUTES.aiExposure, icon: "ai", exact: true },
  ] },
  { key: "learning", label: "Learning & growth", collapsible: true, icon: "plan", items: [
    { label: "Skill path & matching", path: ROUTES.skills, icon: "skills", exact: false },
    { label: "My learning plan", path: ROUTES.learningGoals, icon: "plan", exact: false },
    { label: "Learning records", path: ROUTES.progress, icon: "history", exact: false },
  ] },
  { key: "career", label: "Possibilities", collapsible: true, icon: "career", items: [
    { label: "Explore possibilities", path: ROUTES.possibilities, icon: "career", exact: true },
    { label: "Resume builder", path: ROUTES.resumeBuilder, icon: "resume", exact: true },
    { label: "Interview practice", path: ROUTES.interview, icon: "interview", exact: true },
  ] },
] as const;

export const COLLAPSIBLE_MENU_KEYS: readonly string[] = SIDEBAR_GROUPS.filter(group => group.collapsible).map(group => group.key);

export function filterSidebarGroups(query: string) {
  const term = query.trim().toLowerCase();
  return SIDEBAR_GROUPS.map(group => ({ ...group, items: group.items.filter(item => group.label.toLowerCase().includes(term) || item.label.toLowerCase().includes(term)) }));
}

export function isNavigationItemActive(path: string, item: { path: string; exact: boolean }): boolean {
  return path === item.path || (!item.exact && path.startsWith(`${item.path}/`));
}

export function navigationPath(pathname: string): string {
  if (pathname === ROUTES.learningCentre) return ROUTES.learningGoals;
  return pathname;
}
export function pageLabel(pathname: string): string {
  if (pathname === ROUTES.resumeBuilder) return "Resume builder";
  if (pathname === ROUTES.interview) return "Interview practice";
  if (pathname === ROUTES.possibilities) return "Possibilities";
  if (pathname === ROUTES.learningCentre) return "Learning resources";
  if (pathname === ROUTES.plan) return "My courses";
  if (pathname === ROUTES.progressReviews) return "Progress reviews";
  for (const group of SIDEBAR_GROUPS) {
    const item = group.items.find(item => item.path === pathname);
    if (item) return item.label;
  }
  return "Your workspace";
}
