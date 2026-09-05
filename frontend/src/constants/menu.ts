import type { NavigationItem } from "@/types/navigation";
import { ROUTES } from "@/constants/routes";

export const SIDEBAR_MENU: NavigationItem[] = [
  { key: "work-profile", label: "Work Profile", path: ROUTES.workProfile, epic: "E1", description: "Choose your occupation" },
  { key: "tasks", label: "Tasks", path: ROUTES.task, epic: "E1", description: "Confirm and edit your tasks" },
  { key: "ai-exposure", label: "AI Exposure", path: ROUTES.aiExposure, epic: "E2", description: "Understand task-level AI change" },
  { key: "skills", label: "Skills", path: ROUTES.skills, epic: "E3", description: "See skills connected to tasks" },
];
