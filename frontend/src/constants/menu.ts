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
  { key: "career", label: "Career", collapsible: false, icon: "career", items: [
    { label: "Possibilities", path: ROUTES.possibilities, icon: "career", exact: false },
  ] },
] as const;

export function navigationPath(pathname: string): string {
  if (pathname === ROUTES.learningCentre) return ROUTES.learningGoals;
  return pathname;
}
export function pageLabel(pathname: string): string {
  if (pathname === ROUTES.learningCentre) return "Learning resources";
  if (pathname === ROUTES.plan) return "My courses";
  if (pathname === ROUTES.progressReviews) return "Progress reviews";
  for (const group of SIDEBAR_GROUPS) {
    const item = group.items.find(item => item.path === pathname);
    if (item) return item.label;
  }
  return "Your workspace";
}
