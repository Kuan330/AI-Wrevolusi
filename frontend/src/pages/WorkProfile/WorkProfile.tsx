import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useWorkDraft } from "./hooks/useWorkDraft";
import { discardWorkDraft } from "@/features/work-profile/workProfileDraft";
import { currentWorkspaceSession } from "@/services/accountStorage";
import WorkSceneEditor from "./components/WorkSceneEditor";

export default function WorkProfile() {
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, error: readError } = useWorkDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editorVersion, setEditorVersion] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const confirmed = Boolean(profile?.tasksConfirmed && profile.tasks.length);
  async function cancel() {
    const owner = currentWorkspaceSession();
    setBusy(true); setError("");
    try {
      await discardWorkDraft();
      if (mounted.current && owner === currentWorkspaceSession()) { setParams({}, { replace: true }); setEditorVersion(value => value + 1); }
    } catch (issue) { if (mounted.current && owner === currentWorkspaceSession()) setError(issue instanceof Error ? issue.message : "Could not discard this draft. Please retry."); }
    finally { if (mounted.current && owner === currentWorkspaceSession()) setBusy(false); }
  }
  if (readError) return <section role="alert" className="profile-glass-card p-6"><h1 className="text-xl font-semibold">Your work needs attention</h1><p className="my-3">{readError} Your stored work has not been replaced.</p><Button onClick={() => window.location.reload()}>Reload saved work</Button></section>;

  return <>{error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}<WorkSceneEditor key={editorVersion} confirmed={confirmed} cancelling={busy} onCancel={() => { void cancel(); }} onSaved={() => navigate(ROUTES.aiExposure)} /></>;
}
