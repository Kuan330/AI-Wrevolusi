import type { NavigationItem } from "@/types/navigation";
import { ROUTES } from "@/constants/routes";

export const PRIMARY_NAV_MENU: NavigationItem[] = [
  { key: "work-profile", label: "Work Profile", path: ROUTES.workProfile, epic: "E1", description: "Choose your occupation" },
  { key: "tasks", label: "Tasks", path: ROUTES.task, epic: "E1", description: "Confirm and edit your tasks" },
  { key: "ai-exposure", label: "AI Exposure", path: ROUTES.aiExposure, epic: "E2", description: "Understand task-level AI change" },
  { key: "skills", label: "Skills", path: ROUTES.skills, epic: "E3", description: "See skills connected to tasks" },
  { key: "learning-centre", label: "Learning Resources", path: ROUTES.learningCentre, epic: "E3", description: "Plan what to learn next" },
  { key: "plan", label: "My Plan", path: ROUTES.plan, epic: "E4", description: "Make room for learning and life" },
  { key: "possibilities", label: "Possibilities", path: ROUTES.possibilities, epic: "E5", description: "Explore where your skills can take you" },
];
