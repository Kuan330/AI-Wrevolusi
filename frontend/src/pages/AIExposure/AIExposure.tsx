import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import TaskListCard from "@/pages/Analysis/components/TaskListCard";
import type { TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import OccupationName from "./components/OccupationName";
import OccupationScoreCard from "./components/OccupationScoreCard";
import PersonalTaskOverview from "./components/PersonalTaskOverview";
import PriorityTasks from "./components/PriorityTasks";
import ScoreInfoModal from "./components/ScoreInfoModal";
import { taskOverview } from "./lib/taskOverview";
import "@/pages/Analysis/analysis.css";
import "./exposure.css";

export default function AIExposure() {
  const analysis = readConfirmedAnalysis();
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [scoreRange, setScoreRange] = useState<TaskScoreRange>([0, 1]);
  if (!analysis) return <Navigate to={ROUTES.workProfile} replace />;
  const assessments = analysis.taskExposureAssessments ?? [];
  const overview = taskOverview(analysis.tasks, assessments, scoreRange);
  return (
    <div className="analysis-page exposure-page">
      <PageHeader title="AI exposure" description={
        <>Understand how AI may change the tasks in <OccupationName title={analysis.occupationTitle} path={analysis.occupationPath} />. This is task-level evidence, not a job-loss prediction.</>
      } actions={
        <div className="exposure-page__actions">
          <Button asChild variant="outline" className="exposure-page__button"><Link to={ROUTES.task}>Edit tasks</Link></Button>
          <Button asChild className="profile-blue-btn exposure-page__button"><Link to={ROUTES.skills}>View skills</Link></Button>
        </div>
      } />
      <div className="exposure-page__grid">
        <TaskListCard eyebrow="Task list" title="All assessed tasks"
          description="Tasks are ordered by score. Use the range slider to focus your review."
          tasks={analysis.tasks} taskExposureAssessments={assessments} highlightedIds={[]}
          scoreRange={scoreRange} onScoreRangeChange={setScoreRange} />
        <div className="exposure-page__insights">
          <PersonalTaskOverview overview={overview} range={scoreRange} />
          <PriorityTasks tasks={overview.priorities} />
          <OccupationScoreCard score={analysis.meanScore2025} onOpenDetails={() => setScoreInfoOpen(true)} />
        </div>
      </div>
      <ScoreInfoModal open={scoreInfoOpen} onOpenChange={setScoreInfoOpen} />
    </div>
  );
}
