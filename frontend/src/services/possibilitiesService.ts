import { api } from "@/services/api";
import type { PossibilitiesResponse } from "./possibilitiesTypes";

/** Possibilities ranks occupations with skill matching; allow slower shared hosts. */
const POSSIBILITIES_TIMEOUT_MS = 30000;

export const possibilitiesService = {
  getPossibilities: (signal?: AbortSignal) =>
    api.get<PossibilitiesResponse>("/possibilities", signal, POSSIBILITIES_TIMEOUT_MS),
};
