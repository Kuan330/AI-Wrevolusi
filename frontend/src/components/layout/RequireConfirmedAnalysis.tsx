import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { readJourneyProfile } from "@/features/journey/journey";
import { checkWorkAiFindings } from "@/features/work-profile/checkWorkAiFindings";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/account/useAccount";

export default function RequireConfirmedAnalysis() {
  useAccount();
  const [checking, setChecking] = useState(false);
  const [requestError, setRequestError] = useState("");
  let profile: ReturnType<typeof readJourneyProfile> | null = null;
  let error = "";
  try { profile = readJourneyProfile(); }
  catch (issue) { error = issue instanceof Error ? issue.message : "Could not read your saved work."; }
  if (profile?.analysis?.tasks.length && !checking && !requestError) return <Outlet />;
  const tasksReady = Boolean(profile?.tasksConfirmed && profile.tasks.length);
  const canCheck = tasksReady && Boolean(profile?.tasksOccupationCode);

  async function checkFindings() {
    if (checking) return;
    setChecking(true);
    setRequestError("");
    try { await checkWorkAiFindings(); }
    catch (issue) { setRequestError(issue instanceof Error ? issue.message : "The research check could not finish. Please try again."); }
    finally { setChecking(false); }
  }

  return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6">
    <h1 className="text-2xl font-semibold">{error ? "Your saved work needs attention" : canCheck ? "Check AI findings for your work" : tasksReady ? "Research is not linked to your work yet" : "Start with your profile"}</h1>
    <p className="my-4" role={error ? "alert" : "status"}>{error || (canCheck
      ? "Your profile is saved. Check the available research when you are ready, or go straight to your skills."
      : tasksReady
        ? "Your tasks are saved. Without a matched occupation, we cannot look up reliable AI findings. You can still review your skills."
        : "Confirm the tasks you actually do in your profile before checking AI findings.")}</p>
    {requestError && <p className="my-4" role="alert">{requestError} Your confirmed profile is still saved.</p>}
    <div className="flex flex-wrap gap-3">
      {canCheck && !error && <Button disabled={checking} onClick={() => void checkFindings()}>{checking ? "Checking research…" : requestError ? "Try research check again" : "Check AI findings"}</Button>}
      {tasksReady && !error && <Button asChild variant={canCheck ? "outline" : "default"}><Link to={ROUTES.skills}>Review my skills</Link></Button>}
      <Button asChild variant="outline"><Link to={error ? ROUTES.continue : ROUTES.workProfile}>{error ? "Review recovery options" : "Review my profile"}</Link></Button>
    </div>
  </section>;
}
