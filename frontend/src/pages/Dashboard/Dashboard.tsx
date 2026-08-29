import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import AIExposureSection from "@/pages/Dashboard/AIExposure/AIExposure";
import { readConfirmedAnalysis } from "@/pages/Dashboard/analysisSession";
import CapabilitiesSection from "@/pages/Dashboard/Capabilities/Capabilities";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";

const Dashboard = () => {
  const location = useLocation();
  const analysis = readConfirmedAnalysis();
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<string[]>([]);

  useEffect(() => {
    void referenceService.wefSkills().then(setSkills).catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const node = document.querySelector(location.hash);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, analysis]);

  if (!analysis) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Your analysis"
          description="Confirm an occupation and tasks first. This page then shows occupation exposure, task change, and capabilities together."
        />
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Choose your occupation, review the starter tasks, then confirm them to see this overview.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={ROUTES.workProfile}>Choose occupation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={ROUTES.task}>Review tasks</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your work, task by task"
        description="Occupation band is ILO 2025. Task groups are from 2025 task scores. Skills are matched to the WEF 26 list."
        actions={
          <Link to={ROUTES.task} className="text-sm font-medium text-primary hover:underline">
            Edit tasks
          </Link>
        }
      />
      <AIExposureSection analysis={analysis} highlightedTaskIds={highlightedTaskIds} />
      <CapabilitiesSection tasks={analysis.tasks} skills={skills} onHighlightTasks={setHighlightedTaskIds} />
      <p className="pb-4 text-xs text-muted-foreground">
        This is about task change, not job loss. Skill positions come from WEF Future of Jobs 2025, not a new model score.
      </p>
    </div>
  );
};

export default Dashboard;
