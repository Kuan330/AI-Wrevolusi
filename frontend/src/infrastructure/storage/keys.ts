export const STORAGE_KEYS = {
  userProfile: "aiwrevolusi.userProfile",
  confirmedAnalysis: "aiwrevolusi.confirmedAnalysis",
  learningCentre: "aiwrevolusi.learningCentre",
  learningResourceSelections: "aiwrevolusi.learningResourceSelections.v1",
  courseLibrary: "aiwrevolusi.courseLibrary.v1",
  learningSkills: "aiwrevolusi.learningSkills.v1",
  planner: "aiwrevolusi.planner.v1",
  demoPlanner: "aiwrevolusi.planner.demo.v1",
  possibilitiesSaved: "aiwrevolusi.possibilities.saved",
  possibilitiesIntent: "aiwrevolusi.possibilities.intent",
  selectedOccupation: "aiwrevolusi.selectedOccupation",
  demoCredential: "aiwrevolusi.demo.credential",
  savedCoursesPosition: "aiwrevolusi.savedCoursesPosition.v1",
} as const;

export const WORKSPACE_KEYS = [
  STORAGE_KEYS.userProfile,
  STORAGE_KEYS.confirmedAnalysis,
  STORAGE_KEYS.learningCentre,
  STORAGE_KEYS.learningResourceSelections,
  STORAGE_KEYS.courseLibrary,
  STORAGE_KEYS.learningSkills,
  STORAGE_KEYS.planner,
  STORAGE_KEYS.possibilitiesSaved,
  STORAGE_KEYS.possibilitiesIntent,
] as const;

export const accountCacheKey = (userId: string) =>
  `aiwrevolusi.account.${userId}`;

export const isAccountCacheKey = (key: string) =>
  key.startsWith("aiwrevolusi.account.");
