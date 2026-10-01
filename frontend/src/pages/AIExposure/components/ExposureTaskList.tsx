import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, ListFilter, MousePointer2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { useSearchParams } from "react-router-dom";
import { assistanceForTask, ASSISTANCE_DESCRIPTIONS, type AssistanceCategory } from "@/features/ai-impact/assistance";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";

import TaskImpact from "./TaskImpact";
import { shortTaskLabel, taskDisplayText } from "@/lib/displayText";

type Props = { category?: AssistanceCategory; sortByExposure?: boolean; tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[]; researchChecked?: boolean; researchLoading?: boolean; researchUnavailable?: boolean; occupation?: { title: string; code: string } };

export default function ExposureTaskList({ tasks, assessments, researchChecked = true, researchLoading = false, researchUnavailable = false, occupation, category, sortByExposure = false }: Props) {
  const [params, setParams] = useSearchParams();
  const listRef = useRef<HTMLUListElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setCanScroll(list.scrollHeight > list.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [tasks, category]);
  const selectedId = params.get("task");
  const setSelectedId = (id: string) => setParams(previous => { previous.set("task", id); return previous; });
  const byId = new Map(assessments.map(item => [item.task_id, item]));
  const available = tasks.filter(item => !category || assistanceForTask(item, byId.get(item.id)).category === category);
  const displayed = sortByExposure ? available.slice().sort((a,b) => (assistanceForTask(b,byId.get(b.id)).score ?? -1) - (assistanceForTask(a,byId.get(a.id)).score ?? -1)) : available;
  const task = displayed.find(item => item.id === selectedId) ?? displayed[0];

  if (!task) return <Card className="exposure-filter-empty" role="status">
    <div className="exposure-filter-empty__icon" aria-hidden="true"><ListFilter size={28} strokeWidth={1.6} /></div>
    <p className="dashboard-eyebrow">EXPLORE YOUR WORK</p>
    <h2>No tasks in this category</h2>
    <p>Your current tasks fall into other categories.<br />Choose another category to explore how AI may support your work.</p>
    <div className="exposure-filter-empty__tip"><MousePointer2 size={15} aria-hidden="true" /><span>Click the selected category again to see all tasks.</span></div>
  </Card>;
  const label = (item: ProfileTask) => researchLoading ? "Checking research…" : researchUnavailable ? "Research unavailable" : !researchChecked ? "Research not checked" : assistanceForTask(item, byId.get(item.id)).label;
  return <div className="exposure-task-browser">
    <aside className="exposure-task-picker" aria-label="Choose a task">
      <h2>Your work tasks · {displayed.length}</h2>
      <p className="exposure-section-hint">Select a task to explore AI support and where your judgement matters.</p>
      <div className="exposure-task-picker__mobile"><label htmlFor="impact-task">Your task</label><select id="impact-task" value={task.id} onChange={event => setSelectedId(event.target.value)}>{displayed.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {shortTaskLabel(item.wording, 55)}</option>)}</select></div>
      <ul ref={listRef} className="exposure-task-picker__list">{displayed.map((item, index) => {
        const category = assistanceForTask(item, byId.get(item.id)).category;
        const ready = researchChecked && !researchLoading && !researchUnavailable;
        return <li key={item.id}><button type="button" aria-pressed={task.id === item.id} onClick={() => setSelectedId(item.id)}>
          <span className="exposure-task-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <Tooltip title={taskDisplayText(item.wording)}><span tabIndex={0} className="exposure-task-name">{taskDisplayText(item.wording)}</span></Tooltip>
          <span className={`exposure-task-category category-${ready ? category : "unverified"}`}><Tooltip title={ready ? ASSISTANCE_DESCRIPTIONS[category] : label(item)}><span className="exposure-category-pill">{label(item)}</span></Tooltip></span>
          <span className="exposure-task-arrow" aria-hidden="true">→</span>
        </button></li>;
      })}</ul>
      {canScroll && <div className="exposure-task-scroll-hint"><ChevronsUpDown size={15} aria-hidden="true" /><span>Scroll to explore all tasks</span></div>}
    </aside>
    <TaskImpact key={JSON.stringify([task.id, task.wording, task.notes, byId.get(task.id), researchChecked, researchUnavailable, researchLoading])} occupation={occupation} task={task} assessment={byId.get(task.id)} researchChecked={researchChecked} researchLoading={researchLoading} researchUnavailable={researchUnavailable} />
  </div>;
}
