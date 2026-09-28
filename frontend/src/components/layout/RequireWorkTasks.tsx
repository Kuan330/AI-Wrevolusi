import { Link, Outlet } from "react-router-dom";
import { readJourneyProfile } from "@/features/journey/journey";
import { ROUTES } from "@/constants/routes";

export default function RequireWorkTasks() {
  let hasTasks = false;
  let taskPath: string = ROUTES.workProfile;
  let error = "";
  try {
    const profile = readJourneyProfile();
    hasTasks = profile.tasks.length > 0 && Boolean(profile.tasksConfirmed || profile.analysis);
    if (profile.tasksOccupationCode) taskPath = ROUTES.task;
  }
  catch (issue) { error = issue instanceof Error ? issue.message : "Could not read your saved work."; }
  if (error) return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6"><h1 className="text-2xl font-semibold">Your work needs attention</h1><p role="alert" className="my-4">{error}</p><Link className="underline" to={ROUTES.continue}>Review recovery options</Link></section>;
  if (hasTasks) return <Outlet />;
  return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6"><h1 className="text-2xl font-semibold">Start with your work</h1><p className="my-4">Add and review your actual tasks before reviewing their skills. An AI exposure score is not required.</p><Link className="underline" to={taskPath} state={{ returnTo: ROUTES.skills }}>Review and confirm my work</Link></section>;
}
