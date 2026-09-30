import { useState } from "react";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { taskResearch } from "../lib/taskResearch";
import TaskImpact from "./TaskImpact";
import { shortTaskLabel } from "@/lib/displayText";

type Props = { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[]; researchChecked?: boolean; researchLoading?: boolean; researchUnavailable?: boolean; occupation?: { title: string; code: string } };

export default function ExposureTaskList({ tasks, assessments, researchChecked = true, researchLoading = false, researchUnavailable = false, occupation }: Props) {
  const [selectedId, setSelectedId] = useState(tasks[0]?.id ?? "");
  const task = tasks.find(item => item.id === selectedId) ?? tasks[0];
  const byId = new Map(assessments.map(item => [item.task_id, item]));
  if (!task) return <p>Add and confirm a task in My Work to get started.</p>;
  const label = (item: ProfileTask) => researchLoading ? "Checking research…" : researchUnavailable ? "Research unavailable" : !researchChecked ? "Research not checked" : taskResearch(item, byId.get(item.id)).label;
  return <div className="exposure-task-browser">
    <aside className="exposure-task-picker" aria-label="Choose a task">
      <h2>Choose a task</h2>
      <p>{tasks.length} confirmed {tasks.length === 1 ? "task" : "tasks"} · explore one at a time</p>
      <div className="exposure-task-picker__mobile"><label htmlFor="impact-task">Your task</label><select id="impact-task" value={task.id} onChange={event => setSelectedId(event.target.value)}>{tasks.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {shortTaskLabel(item.wording, 55)}</option>)}</select></div>
      <ul className="exposure-task-picker__list">{tasks.map(item => <li key={item.id}><button type="button" aria-pressed={task.id === item.id} onClick={() => setSelectedId(item.id)}><span>{shortTaskLabel(item.wording)}</span><small>{label(item)}</small></button></li>)}</ul>
    </aside>
    <TaskImpact key={JSON.stringify([task.id, task.wording, task.notes, byId.get(task.id), researchChecked, researchUnavailable, researchLoading])} occupation={occupation} task={task} assessment={byId.get(task.id)} researchChecked={researchChecked} researchLoading={researchLoading} researchUnavailable={researchUnavailable} />
  </div>;
}
