import { useEffect, useRef, useState } from "react";
import { currentWorkspaceSession } from "../../services/accountStorage.ts";
import { readCareerDirection } from "../../services/careerDirection.ts";
import { possibilitiesService } from "../../services/possibilitiesService.ts";
import type { OccupationRequirements } from "../../services/possibilitiesTypes.ts";
import { validTargetRole } from "./targetRole.ts";

type Selection = { code: string | null; error: string };
const selection = (): Selection => {
  try { return { code: readCareerDirection()?.occupation_code ?? null, error: "" }; }
  catch (cause) { return { code: null, error: cause instanceof Error ? cause.message : "Choose a career direction again." }; }
};
type TargetState = { attempt: number; code: string | null; role: OccupationRequirements | null; status: "loading" | "missing" | "ready" | "empty" | "error"; error: string };
export function useResumeTarget(owner: string) {
  const [chosen, setChosen] = useState(selection), [retry, setRetry] = useState(0);
  const session = useRef(currentWorkspaceSession());
  const [state, setState] = useState<TargetState>({ attempt: -1, code: null, role: null, status: "loading", error: "" });
  useEffect(() => {
    const refresh = () => { if (session.current === currentWorkspaceSession()) { const next = selection(); setChosen(old => old.code === next.code && old.error === next.error ? old : next); } };
    refresh(); window.addEventListener("workspace-change", refresh);
    return () => window.removeEventListener("workspace-change", refresh);
  }, [owner]);
  useEffect(() => {
    const request = new AbortController();
    const current = () => !request.signal.aborted && session.current === currentWorkspaceSession() && selection().code === chosen.code;
    if (!chosen.code) return;
    void possibilitiesService.getRequirements(chosen.code, request.signal).then(role => {
      if (!current()) return;
      if (!validTargetRole(role) || role.occupation_code !== chosen.code) throw new Error("This role's requirements could not be read. Retry or choose another direction.");
      setState({ attempt: retry, code: chosen.code, role, status: role.skills.length ? "ready" : "empty", error: "" });
    }).catch(cause => {
      if (current()) setState({ attempt: retry, code: chosen.code, role: null, status: "error", error: cause instanceof Error ? cause.message : "Could not load this role's requirements. Please retry." });
    });
    return () => request.abort();
  }, [owner, chosen.code, chosen.error, retry]);
  const visible: TargetState = !chosen.code
    ? { attempt: retry, code: null, role: null, status: chosen.error ? "error" : "missing", error: chosen.error }
    : state.code === chosen.code && state.attempt === retry ? state
    : { attempt: retry, code: chosen.code, role: null, status: "loading", error: "" };
  return { ...visible, retry: () => { setChosen(selection()); setRetry(value => value + 1); } };
}
