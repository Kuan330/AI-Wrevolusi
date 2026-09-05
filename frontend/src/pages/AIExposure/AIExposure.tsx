import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/common/PageHeader";
import { ROUTES } from "@/constants/routes";
import ExposureSummaryCard from "@/pages/Analysis/components/ExposureSummaryCard";
import TaskListCard from "@/pages/Analysis/components/TaskListCard";
import { OCCUPATION_BANDS, occupationBandFromPotential, type OccupationBandId } from "@/pages/Analysis/lib/occupationBands";
import { taskBandFromAssessment } from "@/pages/Analysis/lib/taskBands";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import type { ProfileTask } from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import "@/pages/Analysis/analysis.css";

const EMPTY_ASSESSMENTS: ConfirmedTaskExposureAssessment[] = [];

const categoryForTask = (
  task: ProfileTask,
  assessment?: ConfirmedTaskExposureAssessment,
): OccupationBandId | null =>
  occupationBandFromPotential(assessment?.potential25 ?? task.potential25)?.value ?? null;

const AIExposure = () => {
  const analysis = readConfirmedAnalysis();
  const [activeCategory, setActiveCategory] = useState<OccupationBandId | null>(null);

  const assessments = analysis?.taskExposureAssessments ?? EMPTY_ASSESSMENTS;
  const assessmentByTaskId = useMemo(
    () => new Map(assessments.map((assessment) => [assessment.task_id, assessment])),
    [assessments],
  );
  const categoryCounts = useMemo(
    () => OCCUPATION_BANDS.reduce((result, category) => {
      result[category.value] = (analysis?.tasks ?? []).filter((task) =>
        categoryForTask(task, assessmentByTaskId.get(task.id)) === category.value,
      ).length;
      return result;
    }, {} as Record<OccupationBandId, number>),
    [analysis?.tasks, assessmentByTaskId],
  );
  const priorityTasks = useMemo(
    () => [...(analysis?.tasks ?? [])]
      .sort((first, second) =>
        (assessmentByTaskId.get(second.id)?.adjusted_score ?? -1) -
        (assessmentByTaskId.get(first.id)?.adjusted_score ?? -1),
      )
      .slice(0, 3),
    [analysis?.tasks, assessmentByTaskId],
  );

  if (!analysis) {
    return <Navigate to={ROUTES.workProfile} replace />;
  }

  const scoreValues = assessments
    .map((assessment) => assessment.adjusted_score)
    .filter((score): score is number => typeof score === "number");
  const averageScore = scoreValues.length
    ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
    : analysis.meanScore2025;
  const activeMeta = OCCUPATION_BANDS.find((category) => category.value === activeCategory) ?? null;

  return (
    <div className="analysis-page space-y-5">
      <PageHeader
        title="AI exposure"
        description={
          <>
            Understand how AI may change the tasks in <strong>{analysis.occupationTitle}</strong>.
            This is task-level evidence, not a job-loss prediction.
          </>
        }
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to={ROUTES.task}>Edit tasks</Link>
            </Button>
            <Button asChild className="profile-blue-btn rounded-full">
              <Link to={ROUTES.skills}>View skills</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <ExposureSummaryCard
            title={analysis.occupationTitle}
            path={analysis.occupationPath}
            potential25={analysis.potential25}
            meanScore2025={averageScore}
          />
        </div>

        <Card className="xl:col-span-8">
          <CardHeader>
            <CardTitle>What the exposure score means</CardTitle>
            <CardDescription>
              A relative 0–1 index of how much the assessed tasks may be affected by generative AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-xl bg-[#eaf3fb] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3d5f7a]">Read the number</p>
              <p className="mt-1 text-sm text-[#574a55]">Higher means more potential task change, not a forecast of when a job will disappear.</p>
            </div>
            <div className="rounded-xl bg-[#f8ecef] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8f4f1f]">Use the ranges</p>
              <p className="mt-1 text-sm text-[#574a55]">Human-led &lt;0.25 · AI-assisted 0.25–&lt;0.40 · Partly automated 0.40–&lt;0.55 · Reshaped ≥0.55. For example, 0.26 is AI-assisted.</p>
            </div>
            <div className="rounded-xl bg-[#f5f3f8] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5a3f6c]">Know the limits</p>
              <p className="mt-1 text-sm text-[#574a55]">The six filters use the database&apos;s `potential25` category; each task score is a separate task-level evidence value.</p>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <TaskListCard
          className="min-h-[34rem] xl:col-span-8"
          eyebrow={activeMeta ? activeMeta.label : "Task evidence"}
          title={activeMeta ? `${activeMeta.label} tasks` : "All assessed tasks"}
          description={activeMeta ? "Use this database category to focus your next conversation or review. Task scores remain task-level evidence." : "Tasks are ordered by assessed exposure so the highest-change work is easy to review first. Filters use the six database categories."}
          tasks={analysis.tasks}
          taskExposureAssessments={assessments}
          activeCategory={activeCategory}
          categoryCounts={categoryCounts}
          onSelectCategory={setActiveCategory}
          highlightedIds={[]}
          onClear={activeCategory ? () => setActiveCategory(null) : undefined}
        />

        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Tasks needing attention</CardTitle>
            <CardDescription>
              A focus list based on the highest assessed task values. It is a review aid, not a personal readiness score.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {priorityTasks.map((task: ProfileTask, index) => {
              const assessment = assessmentByTaskId.get(task.id);
              const taskState = taskBandFromAssessment(assessment);
              return (
                <div key={task.id} className="rounded-xl border border-white/80 bg-white/65 p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf3fb] text-xs font-semibold text-[#3d5f7a]">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm leading-5 text-[#2f2430]">{task.wording}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {taskState ? <Badge variant="outline" className="rounded-full border-0" style={{ background: `${taskState.color}55`, color: taskState.ink }}>{taskState.label}</Badge> : null}
                        {typeof assessment?.adjusted_score === "number" ? <span className="text-xs tabular-nums text-[#7f7280]">Task score {assessment.adjusted_score.toFixed(2)} / 1.0</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {priorityTasks.length === 0 ? <p className="text-sm text-[#7f7280]">No assessed tasks yet. Return to your tasks to run the assessment.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIExposure;
