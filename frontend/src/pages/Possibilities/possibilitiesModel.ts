import type { PossibilitySkill, PossibilityDirection, PossibilitiesResponse } from "@/services/possibilitiesTypes";
export type { PossibilitySkillState, PossibilitySkill, PossibilityDirection, PossibilitiesResponse } from "@/services/possibilitiesTypes";
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
  try {
    await options.flush();
  } catch {
    // AccountProvider owns workspace-sync recovery. A stale local revision must
    // not block this read-only page from showing the last saved server data.
  }
  if (options.signal.aborted) return;
  try {
    const response = await options.get(options.signal);
    if (!options.signal.aborted) options.onSuccess(response);
  } catch (error) {
    if (!options.signal.aborted) options.onError(error);
  }
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
