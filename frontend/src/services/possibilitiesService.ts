import { api } from "@/services/api";
import type { OccupationRequirements, PossibilitiesResponse } from "./possibilitiesTypes";

/** Possibilities ranks occupations with skill matching; allow slower shared hosts. */
const POSSIBILITIES_TIMEOUT_MS = 30000;

export const possibilitiesService = {
  getRequirements: (occupationCode: string, signal?: AbortSignal) =>
    api.get<OccupationRequirements>(`/possibilities/${encodeURIComponent(occupationCode)}/requirements`, signal, POSSIBILITIES_TIMEOUT_MS),
  getPossibilities: (signal?: AbortSignal) =>
    api.get<PossibilitiesResponse>("/possibilities", signal, POSSIBILITIES_TIMEOUT_MS),
};
