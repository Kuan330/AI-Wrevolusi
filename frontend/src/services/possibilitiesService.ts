import { api } from "@/services/api";
import type { PossibilitiesResponse } from "@/pages/Possibilities/possibilitiesModel";
export const possibilitiesService = {
  getPossibilities: (signal?: AbortSignal) => api.get<PossibilitiesResponse>("/possibilities", signal),
};
