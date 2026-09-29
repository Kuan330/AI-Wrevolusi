import { Link, Outlet, useLocation } from "react-router-dom";
import { readJourneyProfile } from "@/features/journey/journey";
import { ROUTES } from "@/constants/routes";

export default function RequireWorkTasks() {
  const location = useLocation();
  let hasTasks = false;
  let error = "";
  try {
    const profile = readJourneyProfile();
    hasTasks = profile.tasks.length > 0 && Boolean(profile.tasksConfirmed || profile.analysis);
  }
  catch (issue) { error = issue instanceof Error ? issue.message : "Could not read your saved work."; }
  if (error) return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6"><h1 className="text-2xl font-semibold">Your work needs attention</h1><p role="alert" className="my-4">{error}</p><Link className="underline" to={ROUTES.continue}>Review recovery options</Link></section>;
  if (hasTasks) return <Outlet />;
  return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6"><h1 className="text-2xl font-semibold">Start with your work</h1><p className="my-4">Save your profile with the tasks you actually do. You can review skills without checking AI findings.</p><Link className="underline" to={ROUTES.workProfile} state={{ returnTo: location.pathname }}>Review my profile</Link></section>;
}
