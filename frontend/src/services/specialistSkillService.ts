import { api } from "./api.ts";

export interface SpecialistSkill {
  uri: string;
  label: string;
  description: string;
  relation: "essential" | "optional" | null;
  source_relations?: string[];
  skill_type: string;
  aliases: string[];
  match_type?: "exact" | "terms" | "related";
  matched_terms?: string[];
}
export interface SpecialistOccupation { uri: string; label: string; isco_code: string }
export interface SpecialistSearchResult<T> {
  source: "ESCO"; version: string; items: T[]; total: number; limit: number; offset: number;
  attribution?: string; license?: string; license_url?: string;
  search_mode?: "browse" | "matches" | "related" | "none";
}
export interface SpecialistCatalogue {
  source: "ESCO";
  version: string;
  occupation_uri: string;
  occupation_label: string;
  isco_code: string;
  occupations: SpecialistOccupation[];
  skills: SpecialistSkill[];
  mapping_note: string;
  attribution?: string;
  license?: string;
  license_url?: string;
}
export const specialistSkillService = {
  forOccupation: async (sourceOccupationUri: string, signal?: AbortSignal) => {
    // MASCO and ISCO codes can share a number while describing different jobs.
    // Only an explicitly selected ESCO source concept can retrieve role skills.
    if (!/^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sourceOccupationUri)) {
      throw new Error("Choose an ESCO source occupation from the search results.");
    }
    return api.get<SpecialistCatalogue>(
      `/reference/specialist-skills?${new URLSearchParams({ occupation_uri: sourceOccupationUri })}`, signal,
    );
  },
  occupations: (query: string, offset: number, signal?: AbortSignal) => api.get<SpecialistSearchResult<SpecialistOccupation>>(
    `/reference/specialist-occupations?${new URLSearchParams({ q: query, limit: "20", offset: String(offset) })}`, signal,
  ),
  skills: (query: string, offset: number, signal?: AbortSignal) => api.get<SpecialistSearchResult<SpecialistSkill>>(
    `/reference/specialist-skill-search?${new URLSearchParams({ q: query, limit: "20", offset: String(offset) })}`, signal,
  ),
};
