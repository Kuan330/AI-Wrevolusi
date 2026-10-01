/** Canonical destinations. All links use this map; old bookmarks only redirect. */
export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  workProfile: "/work",
  task: "/work/tasks",
  aiExposure: "/work/ai-impact",
  skills: "/learning/skills",
  learningGoals: "/learning/plan",
  plan: "/learning/plan/courses",
  learningCentre: "/learning/resources",
  progress: "/learning/history",
  progressReviews: "/learning/history/reviews",
  possibilities: "/career/possibilities",
  continue: "/resume",
} as const;

export const LEGACY_ROUTES: Readonly<Record<string, string>> = {
  "/profile": ROUTES.workProfile,
  "/profile/tasks": ROUTES.task,
  "/work-profile": ROUTES.workProfile,
  "/ai-exposure": ROUTES.aiExposure,
  "/skills": ROUTES.skills,
  "/learning-goals": ROUTES.learningGoals,
  "/plan": ROUTES.plan,
  "/learning-centre": ROUTES.learningCentre,
  "/progress": ROUTES.progressReviews,
  "/possibilities": ROUTES.possibilities,
  "/continue": ROUTES.continue,
};
