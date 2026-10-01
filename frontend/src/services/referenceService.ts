import { PILOT_WEF_SKILLS } from "@/data/pilotWefSkills";
import { api } from "@/services/api";
import { createRequestCache } from "@/lib/requestCache";
import type { ReferenceOccupation, ReferenceTask, WefSkill } from "@/types/reference";

const withPilotFallback = async <T>(request: () => Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await request();
  } catch {
    return fallback();
  }
};

// The WEF list is shared reference data, so a repeat visit can show it at once.
const wefSkillCache = createRequestCache<WefSkill[]>({ maxAgeMs: 24 * 60 * 60_000, storageKey: "aiwrevolusi.reference.wefSkills.v1" });

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
  searchOccupations: async (query: string, signal?: AbortSignal, area?: string) =>
    onlyUnits(await api.get<ReferenceOccupation[]>(
      `/reference/occupations?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), ...(area ? { area } : {}) })}`,
      signal,
      12_000,
    )),
  tasks: (occupationCode: string) =>
    api.get<ReferenceTask[]>(
      `/reference/occupations/${encodeURIComponent(occupationCode)}/tasks`,
    ),
  wefSkills: () =>
    withPilotFallback(
      () => wefSkillCache.load("all", () => api.get<WefSkill[]>("/reference/wef-skills")),
      () => wefSkillCache.peek("all")?.value ?? PILOT_WEF_SKILLS,
    ),
  /** The last loaded WEF list, if any, for a first render without a loading state. */
  cachedWefSkills: () => wefSkillCache.peek("all")?.value,
};

