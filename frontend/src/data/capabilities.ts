import type { Capability } from "@/types/capability";

export const mockCapabilities: Capability[] = [
  {
    id: "cap-1",
    name: "Customer relationship judgement",
    linkedTaskIds: ["task-1", "task-3"],
    evolution: "continue_to_be_useful",
    evidence: ["Handles nuanced customer issues", "Guides team on service standards"],
  },
  {
    id: "cap-2",
    name: "Sales reporting",
    linkedTaskIds: ["task-2"],
    evolution: "needs_updating",
    evidence: ["Reporting workflow increasingly AI-assisted"],
  },
];
