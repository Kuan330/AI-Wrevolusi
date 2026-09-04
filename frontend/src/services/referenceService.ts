import {
  getPilotOccupation,
  listPilotOccupations,
  listPilotTasks,
  searchPilotOccupations,
} from "@/data/pilotReference";
import { PILOT_WEF_SKILLS } from "@/data/pilotWefSkills";
import { api } from "@/services/api";
import type {
  ReferenceDataVersion,
  ReferenceOccupation,
  ReferenceTask,
  WefSkill,
} from "@/types/reference";

const withPilotFallback = async <T>(request: () => Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await request();
  } catch {
    return fallback();
  }
};

const onlyUnits = (rows: ReferenceOccupation[]) => rows.filter((item) => item.level === "unit");

export const referenceService = {
  version: () => api.get<ReferenceDataVersion>("/reference/version"),
  occupations: (parent?: string) =>
    withPilotFallback(
      () =>
        api.get<ReferenceOccupation[]>(
          parent
            ? `/reference/occupations?parent=${encodeURIComponent(parent)}`
            : "/reference/occupations",
        ),
      () => listPilotOccupations(parent),
    ),
  getOccupation: (code: string) =>
    withPilotFallback(
      () => api.get<ReferenceOccupation>(`/reference/occupations/${encodeURIComponent(code)}`),
      () => {
        const row = getPilotOccupation(code);
        if (!row) throw new Error("occupation not found");
        return row;
      },
    ),
  searchOccupations: async (query: string) => {
    const rows = await withPilotFallback(
      () =>
        api.get<ReferenceOccupation[]>(
          `/reference/occupations?q=${encodeURIComponent(query)}`,
        ),
      () => searchPilotOccupations(query),
    );
    return onlyUnits(rows);
  },
  tasks: (occupationCode: string) =>
    withPilotFallback(
      () =>
        api.get<ReferenceTask[]>(
          `/reference/occupations/${encodeURIComponent(occupationCode)}/tasks`,
        ),
      () => listPilotTasks(occupationCode),
    ),
  wefSkills: () =>
    withPilotFallback(
      () => api.get<WefSkill[]>("/reference/wef-skills"),
      () => PILOT_WEF_SKILLS,
    ),
};
