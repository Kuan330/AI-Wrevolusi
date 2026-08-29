export type CapabilityEvolution =
  | "continue_to_be_useful"
  | "needs_strengthening"
  | "needs_updating";

export interface Capability {
  id: string;
  name: string;
  description?: string;
  linkedTaskIds: string[];
  evolution: CapabilityEvolution;
  evidence: string[];
}
