import { PILOT_WEF_SKILLS } from "@/data/pilotWefSkills";
import { api } from "@/services/api";
import type { ReferenceOccupation, ReferenceTask, WefSkill } from "@/types/reference";

const withPilotFallback = async <T>(request: () => Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await request();
  } catch {
    return fallback();
  }
};

const onlyUnits = (rows: ReferenceOccupation[]) => rows.filter((item) => item.level === "unit");

export const referenceService = {
  occupations: (parent?: string) =>
    api.get<ReferenceOccupation[]>(
      parent
        ? `/reference/occupations?parent=${encodeURIComponent(parent)}`
        : "/reference/occupations",
    ),
  getOccupation: (code: string) =>
    api.get<ReferenceOccupation>(`/reference/occupations/${encodeURIComponent(code)}`),
  searchOccupations: async (query: string) =>
    onlyUnits(await api.get<ReferenceOccupation[]>(
      `/reference/occupations?q=${encodeURIComponent(query.trim())}`,
    )),
  tasks: (occupationCode: string) =>
    api.get<ReferenceTask[]>(
      `/reference/occupations/${encodeURIComponent(occupationCode)}/tasks`,
    ),
  wefSkills: () =>
    withPilotFallback(
      () => api.get<WefSkill[]>("/reference/wef-skills"),
      () => PILOT_WEF_SKILLS,
    ),
};

