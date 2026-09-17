export type PossibilitySkillState = "have" | "learning" | "shortlisted" | "missing";
export type PossibilitySkill = { skill_id: number; skill_slug: string; name: string; state: PossibilitySkillState };
export type PossibilityDirection = { occupation_code: string; title: string; area: string | null; description: string; coverage_pct: number | null; skills: PossibilitySkill[] };
export type PossibilitiesResponse = {
  contract_version: "1"; score_semantics: "direction_skill_coverage"; disclaimer: string;
  source: "live" | "demo"; status: "ready" | "needs_profile" | "unavailable";
  current_role: { occupation_code: string; title: string } | null;
  current_role_coverage_pct: number | null; skills: PossibilitySkill[]; directions: PossibilityDirection[];
  chosen_direction_code: string | null; chosen_direction_coverage_pct: number | null; shortlisted_skill_ids: number[];
};
export type PossibilitiesData = {
  source: "live" | "demo"; disclaimer: string; status: PossibilitiesResponse["status"];
  currentRole: PossibilitiesResponse["current_role"]; currentRoleCoverage: number | null;
  skills: PossibilitySkill[]; directions: PossibilityDirection[];
  chosenDirectionCode: string | null; chosenDirectionCoverage: number | null; shortlistedSkillIds: number[];
};
export function toPossibilitiesData(response: PossibilitiesResponse): PossibilitiesData {
  return { source: response.source, disclaimer: response.disclaimer, status: response.status,
    currentRole: response.current_role, currentRoleCoverage: response.current_role_coverage_pct,
    skills: response.skills, directions: response.directions, chosenDirectionCode: response.chosen_direction_code, chosenDirectionCoverage: response.chosen_direction_coverage_pct, shortlistedSkillIds: response.shortlisted_skill_ids };
}
export function possibilitiesProfilePath(workspace: { tasksOccupationCode?: string | null } | null | undefined): string {
  return workspace?.tasksOccupationCode ? "/profile/tasks" : "/profile";
}

export async function loadSavedPossibilities(options: {
  signal: AbortSignal;
  flush: () => Promise<void>;
  get: (signal: AbortSignal) => Promise<PossibilitiesResponse>;
  onSuccess: (response: PossibilitiesResponse) => void;
  onError: (error: unknown) => void;
}): Promise<void> {
  if (options.signal.aborted) return;
  let response: PossibilitiesResponse;
  try {
    await options.flush();
    if (options.signal.aborted) return;
    response = await options.get(options.signal);
  } catch (error) {
    if (!options.signal.aborted) options.onError(error);
    return;
  }
  if (!options.signal.aborted) options.onSuccess(response);
}

export type PossibilitiesViewState = "loading" | "error" | "needs-profile" | "unavailable" | "ready";
export function possibilitiesViewState(input: { loading: boolean; error: string; data: PossibilitiesResponse | null }): PossibilitiesViewState {
  if (input.loading) return "loading";
  if (input.error || !input.data) return "error";
  if (input.data.status === "needs_profile") return "needs-profile";
  if (input.data.status === "unavailable") return "unavailable";
  return "ready";
}
export function shouldApplyPossibilitiesResult(requestId: number, latestRequestId: number, mounted: boolean): boolean {
  return mounted && requestId === latestRequestId;
}
