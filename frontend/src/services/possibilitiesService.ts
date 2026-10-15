import { api } from "./api.ts";
import { accountStorage, currentWorkspaceOwner, currentWorkspaceSession } from "./accountStorage.ts";
import { possibilitiesCacheStorage } from "../infrastructure/storage/possibilitiesCacheStorage.ts";
import type { OccupationRequirements, PossibilitiesResponse } from "./possibilitiesTypes";
const TIMEOUT = 30000;
const inputs = ["aiwrevolusi.userProfile", "aiwrevolusi.confirmedAnalysis", "aiwrevolusi.journey.v1", "aiwrevolusi.plan.courses.v1", "aiwrevolusi.possibilities.shortlist"];
export const possibilitiesService = {
  getRequirements: (code: string, signal?: AbortSignal) => api.get<OccupationRequirements>(`/possibilities/${encodeURIComponent(code)}/requirements`, signal, TIMEOUT),
  async getPossibilities(signal?: AbortSignal): Promise<PossibilitiesResponse> {
    const owner = currentWorkspaceOwner(), session = currentWorkspaceSession();
    const fingerprint = JSON.stringify(inputs.map(key => accountStorage.getItem(key)));
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    if (owner) try {
      const cached = JSON.parse(possibilitiesCacheStorage.getItem(owner) ?? "null");
      if (cached?.fingerprint === fingerprint && cached.response?.contract_version === "2" && Array.isArray(cached.response.directions)) return cached.response;
    } catch { /* Missing or corrupted caches are rebuilt from the API. */ }
    const response = await api.get<PossibilitiesResponse>("/possibilities", signal, TIMEOUT);
    if (owner && session === currentWorkspaceSession() && !signal?.aborted && response.status === "ready") {
      possibilitiesCacheStorage.setItem(owner, JSON.stringify({ fingerprint, response }));
    }
    return response;
  },
};
