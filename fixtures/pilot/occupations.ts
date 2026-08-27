import type { Occupation } from "@/lib/types/domain";

export const pilotUserName = "Christine";
export const pilotLocation = "Selangor, Malaysia";

export const pilotOccupations: Occupation[] = [
  {
    id: "occ-christine-primary",
    title: "Sales Supervisor",
    mascoCode: null,
    status: "validated",
    notes:
      "TODO: Add Christine's validated MASCO code once internal validation is completed.",
  },
  {
    id: "occ-related-1",
    title: "Related occupation 1",
    mascoCode: null,
    status: "pending-validation",
    notes:
      "TODO: Confirm first related occupation title and validated MASCO code for pilot scope.",
  },
  {
    id: "occ-related-2",
    title: "Related occupation 2",
    mascoCode: null,
    status: "pending-validation",
    notes:
      "TODO: Confirm second related occupation title and validated MASCO code for pilot scope.",
  },
];

export const pilotDataTodos = {
  taskData:
    "TODO: Add validated task data for each pilot occupation when source and mapping are approved.",
  iscoMapping:
    "TODO: Add validated MASCO-to-ISCO mapping only after mapping review is completed.",
  aiExposureScores:
    "TODO: Add validated AI exposure inputs when approved for product use.",
} as const;
