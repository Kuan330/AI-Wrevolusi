export type OccupationStatus = "validated" | "related" | "pending-validation";

export type Occupation = {
  id: string;
  title: string;
  mascoCode: string | null;
  status: OccupationStatus;
  notes?: string;
};

export type TaskContext = {
  setting: string;
  toolsUsed: string[];
  peopleInvolved: string[];
  frequency: string;
};

export type WorkTask = {
  id: string;
  occupationId: string;
  title: string;
  description: string;
  context: TaskContext;
};

export type TaskChangeType = "automate" | "augment" | "unchanged" | "unknown";

export type TaskChangeResult = {
  taskId: string;
  changeType: TaskChangeType;
  confidence: number | null;
  summary: string;
};

export type Capability = {
  id: string;
  name: string;
  description: string;
  evidenceTaskIds: string[];
};

export type Pathway = {
  id: string;
  title: string;
  description: string;
  relatedOccupationId: string;
  capabilityMatchNotes: string;
};

export type Priority = {
  id: string;
  title: string;
  reason: string;
  score: number | null;
};

export type PreparationAction = {
  id: string;
  title: string;
  description: string;
  estimatedTimePerWeek: string;
  linkedPriorityId: string;
};

export type CorrectableEntityType =
  | "occupation"
  | "task"
  | "task-change"
  | "capability"
  | "pathway"
  | "priority"
  | "action";

export type UserCorrection = {
  id: string;
  entityType: CorrectableEntityType;
  entityId: string;
  originalValue: string;
  correctedValue: string;
  reason: string;
  createdAtIso: string;
};
