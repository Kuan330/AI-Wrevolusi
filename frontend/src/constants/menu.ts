import type { NavigationItem } from "@/types/navigation";
import { ROUTES } from "@/constants/routes";

export const SIDEBAR_MENU: NavigationItem[] = [
  { key: "dashboard", label: "Dashboard", path: ROUTES.dashboard, epic: "Overview", description: "Progress and recent updates" },
  { key: "work-profile", label: "Work Profile", path: ROUTES.workProfile, epic: "E1", description: "Choose your occupation" },
  { key: "tasks", label: "Tasks", path: ROUTES.task, epic: "E1", description: "Confirm and edit your tasks" },
  { key: "ai-exposure", label: "AI Exposure", path: ROUTES.aiExposure, epic: "E2", description: "Task change interpretation" },
  { key: "capabilities", label: "Capabilities", path: ROUTES.capabilities, epic: "E3", description: "Recognise existing value" },
  { key: "interpretation", label: "Interpretation", path: ROUTES.interpretation, epic: "E4", description: "Review and correction" },
  { key: "priorities", label: "Priorities", path: ROUTES.priorities, epic: "E5", description: "Optional pathway" },
  { key: "preparation", label: "Preparation", path: ROUTES.preparation, epic: "E6", description: "Preparation priorities" },
  { key: "flexibility", label: "Flexibility", path: ROUTES.flexibility, epic: "E7", description: "Adaptive planning" },
  { key: "task-efficiency", label: "Task Efficiency", path: ROUTES.taskEfficiency, epic: "E8", description: "Everyday task support" },
];
