import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getContinueDestination, readJourneyState } from "@/features/journey/journey";
import { readLearningGoals } from "@/features/learning-goals/learningGoals";
import { readWorkDraft } from "@/features/work-profile/workProfileDraft";
import { useAccount } from "@/components/account/useAccount";
import { syncError } from "@/services/accountStorage";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";

export default function ContinueJourney() {
  const { reload } = useAccount();
  const [result] = useState<{ path?: string; error?: string }>(() => {
    try {
      if (syncError) throw new Error("Your account has changes that need attention. Use the recovery message above before choosing a new continuation.");
      const path = getContinueDestination();
      const resume = readJourneyState().resume;
      const goals = readLearningGoals();
      // Respect an explicit work/course continuation and unfinished profile edits.
      // Specialist goals do not create a second legacy learning context.
      if (!readWorkDraft() && (!resume || resume.kind === "learning") && goals.length) {
        const latest = [...goals].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        if (!resume || latest.updatedAt >= resume.updatedAt)
          return { path: `${ROUTES.learningGoals}?${new URLSearchParams({ goal: latest.id })}` };
      }
      return { path };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Your saved journey could not be restored." };
    }
  });
  if (result.path) return <Navigate to={result.path} replace />;
  if (!result.error) return <p role="status" className="p-6">Finding your next step…</p>;
  return <section className="mx-auto max-w-2xl rounded-2xl border bg-white/80 p-6">
    <h1 className="text-2xl font-semibold">Your saved journey needs attention</h1>
    <p role="alert" className="my-4">{result.error}</p>
    <p className="mb-4 text-sm">Your stored work has not been replaced. You can inspect your saved pages or retry restoring the account.</p>
    <div className="flex flex-wrap gap-3">
      <Button onClick={reload}>Retry account restore</Button>
      <Button asChild variant="outline"><Link to={ROUTES.learningGoals}>View My Learning</Link></Button>
      <Button asChild variant="outline"><Link to={ROUTES.workProfile}>View My Work</Link></Button>
    </div>
  </section>;
}
