import { Link, Outlet } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { readJourneyProfile } from "@/features/journey/journey";
import { Button } from "@/components/ui/button";

export default function RequireConfirmedAnalysis() {
  let profile: ReturnType<typeof readJourneyProfile> | null = null;
  let error = "";
  try { profile = readJourneyProfile(); }
  catch (issue) { error = issue instanceof Error ? issue.message : "Could not read your saved work."; }
  if (profile?.analysis?.tasks.length) return <Outlet />;
  const tasksReady = Boolean(profile?.tasksConfirmed && profile.tasks.length);
  return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6">
    <h1 className="text-2xl font-semibold">{error ? "Your saved work needs attention" : "Your AI findings are not ready yet"}</h1>
    <p className="my-4" role={error ? "alert" : "status"}>{error || (tasksReady
      ? "Your confirmed tasks are saved. You can retry the evidence check or review skills without an AI exposure score."
      : "Review and confirm the tasks you actually do before checking the available AI evidence.")}</p>
    <div className="flex flex-wrap gap-3">
      <Button asChild><Link to={error ? ROUTES.continue : profile?.tasksOccupationCode ? ROUTES.task : ROUTES.workProfile}>{error ? "Review recovery options" : "Review my tasks"}</Link></Button>
      {tasksReady && <Button asChild variant="outline"><Link to={ROUTES.skills}>Review my skills</Link></Button>}
    </div>
  </section>;
}
