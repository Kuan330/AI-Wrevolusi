import type {
  Capability,
  Pathway,
  Priority,
  TaskChangeResult,
  WorkTask,
} from "@/lib/types/domain";

export type TaskMatchingAndClassificationProvider = {
  classifyTaskChanges(input: { tasks: WorkTask[] }): Promise<TaskChangeResult[]>;
};

export type CapabilityRecognitionProvider = {
  recogniseCapabilities(input: {
    tasks: WorkTask[];
    taskChanges: TaskChangeResult[];
  }): Promise<Capability[]>;
};

export type PathwayRankingProvider = {
  rankPathways(input: {
    capabilities: Capability[];
    candidatePathways: Pathway[];
  }): Promise<Pathway[]>;
};

export type PriorityRankingProvider = {
  rankPriorities(input: {
    pathways: Pathway[];
    capabilities: Capability[];
  }): Promise<Priority[]>;
};
