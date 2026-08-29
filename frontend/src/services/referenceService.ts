import { api } from "@/services/api";
import type { ReferenceOccupation, ReferenceTask } from "@/types/reference";

export const referenceService = {
  occupations: (parent?: string) =>
    api.get<ReferenceOccupation[]>(
      parent ? `/reference/occupations?parent=${encodeURIComponent(parent)}` : "/reference/occupations",
    ),
  searchOccupations: (query: string) =>
    api.get<ReferenceOccupation[]>(
      `/reference/occupations?q=${encodeURIComponent(query)}`,
    ),
  tasks: (occupationCode: string) =>
    api.get<ReferenceTask[]>(
      `/reference/occupations/${encodeURIComponent(occupationCode)}/tasks`,
    ),
};
