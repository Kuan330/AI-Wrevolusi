import type { ComponentProps } from "react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import {
  readConfirmedAnalysis,
  saveTaskPractice,
} from "@/pages/WorkProfile/userProfile";
import ExposureScoreOverview from "./components/ExposureScoreOverview";
import ExposureTaskList from "./components/ExposureTaskList";
import TaskGuide from "./components/TaskGuide";
import OccupationName from "./components/OccupationName";
import { taskOverview } from "./lib/taskOverview";
import "@/pages/Analysis/analysis.css";
import "./exposure.css";

export default function AIExposure() {
  const [analysis, setAnalysis] = useState(readConfirmedAnalysis);
  const [scoreRange, setScoreRange] = useState<TaskScoreRange>([0, 1]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!analysis)
    return (
      <Navigate
        {...({ to: ROUTES.workProfile, replace: true } satisfies Partial<
          ComponentProps<typeof Navigate>
        >)}
      />
    );
  const assessments = analysis.taskExposureAssessments ?? [];
  const overview = taskOverview(analysis.tasks, assessments);
  const task = analysis.tasks.find((item) => item.id === selectedId) ?? null;
  const occupationNameProps1 = {
    title: analysis.occupationTitle,
    path: analysis.occupationPath,
  } satisfies Partial<ComponentProps<typeof OccupationName>>;
  const buttonProps2 = {
    asChild: true,
    variant: "outline",
    className: "profile-outline-btn rounded-full",
  } satisfies Partial<ComponentProps<typeof Button>>;
  const buttonProps3 = {
    asChild: true,
    className: "profile-gradient-btn rounded-full font-normal",
  } satisfies Partial<ComponentProps<typeof Button>>;
  const exposureTaskListProps4 = {
    tasks: analysis.tasks,
    assessments: assessments,
    selectedId: selectedId,
    onSelect: (id) => {
      setSelectedId(id);
      if (window.matchMedia("(max-width: 1023px)").matches)
        requestAnimationFrame(() =>
          document
            .getElementById("task-guide")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
    },
    range: scoreRange,
    onRangeChange: setScoreRange,
  } satisfies Partial<ComponentProps<typeof ExposureTaskList>>;
  const taskGuideProps5 = {
    task: task,
    assessment: assessments.find((item) => item.task_id === selectedId),
    onClear: () => setSelectedId(null),
    onSave: (update) => {
      if (task)
        setAnalysis(
          saveTaskPractice(
            analysis.occupationCode,
            task.id,
            task.wording,
            update,
          ),
        );
    },
  } satisfies Partial<ComponentProps<typeof TaskGuide>>;
  return (
    <div className="analysis-page exposure-page mx-auto w-full max-w-[1180px] pb-10">
      <PageHeader
        className="flex-col items-start sm:flex-row sm:items-center"
        title="How AI may change your work"
        description={
          <>
            Explore your tasks in <OccupationName {...occupationNameProps1} />,
            try practical assistance and record what works for you.
          </>
        }
        actions={
          <div className="exposure-page__actions">
            <Button {...buttonProps2}>
              <Link to={ROUTES.task}>Edit tasks</Link>
            </Button>
            <Button {...buttonProps3}>
              <Link to={ROUTES.skills}>View skills</Link>
            </Button>
          </div>
        }
      />
      <ExposureScoreOverview overview={overview} />
      <div
        id="task-breakdown"
        tabIndex={-1}
        className="exposure-workspace scroll-mt-24"
      >
        <ExposureTaskList {...exposureTaskListProps4} />
        <TaskGuide key={selectedId ?? "welcome"} {...taskGuideProps5} />
      </div>
    </div>
  );
}
