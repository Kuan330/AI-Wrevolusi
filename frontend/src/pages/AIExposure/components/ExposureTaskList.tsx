import { useState } from "react";
import { Button } from "@/components/ui/button";
import TaskDetailsDrawer from "@/pages/Analysis/components/TaskDetailsDrawer";
import { taskScore } from "@/pages/Analysis/lib/taskScore";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

type Props = { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[] };

export default function ExposureTaskList({ tasks, assessments }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const byId = new Map(assessments.map(item => [item.task_id, item]));
  const ordered = tasks.map(task => ({ task, score: taskScore(task, byId.get(task.id)) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const visible = showAll ? ordered : ordered.slice(0, 3);
  const detailsTask = tasks.find(task => task.id === detailsId) ?? null;
  return <section className="exposure-glass-card p-5 sm:p-6" aria-labelledby="task-review-title">
    <h2 id="task-review-title" className="text-xl font-semibold">Choose a task to understand</h2>
    <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">Tasks with higher research scores appear first. Open one to see the evidence and guidance for trying AI.</p>
    <p className="mt-3 text-xs text-muted-foreground">A higher score does not mean a task is safe to automate. You still need to check the result.</p>
    <ol className="mt-5 divide-y divide-border" aria-label="Your tasks">
      {visible.map(({ task, score }) => <li key={task.id} className="py-4 first:pt-0">
        <h3 className="text-base font-medium leading-6">{task.wording}</h3>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{score == null ? "No reliable research score" : `Research score: ${Math.round(score * 100)} out of 100`}</span>
          <Button variant="outline" className="min-h-11 rounded-full" aria-haspopup="dialog" aria-label={`Understand this task: ${task.wording}`} onClick={() => setDetailsId(task.id)}>Understand this task</Button>
        </div>
      </li>)}
    </ol>
    {!tasks.length && <p className="mt-4 text-sm">Add a task in My Work to get started.</p>}
    {tasks.length > 3 && <Button variant="link" className="mt-3 min-h-11 px-0" onClick={() => setShowAll(value => !value)}>
      {showAll ? "Show fewer tasks" : `Show all ${tasks.length} tasks`}
    </Button>}
    <TaskDetailsDrawer selectedTask={detailsTask} selectedAssessment={detailsTask ? byId.get(detailsTask.id) ?? null : null} onClose={() => setDetailsId(null)} />
  </section>;
}
