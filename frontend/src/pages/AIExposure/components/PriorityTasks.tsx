import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TaskDetailsDrawer from "@/pages/Analysis/components/TaskDetailsDrawer";
import type { TaskOverview } from "../lib/taskOverview";

export default function PriorityTasks({ tasks }: { tasks: TaskOverview["priorities"] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tasks.find(({ task }) => task.id === selectedId);
  return (
    <Card className="analysis-card priority-tasks">
      <p className="exposure-eyebrow">Where to start</p>
      <h2 className="exposure-title">Your highest-exposure tasks</h2>
      <p className="exposure-caption">The highest scores across your confirmed tasks, independent of the filter. Start by reviewing how these tasks may change.</p>
      {tasks.length === 0 ? <p className="exposure-caption">No task scores are available yet.</p> : (
        <ol className="priority-tasks__list">
          {tasks.map(({ task, score, assessment }, index) => (
            <li key={task.id} className="priority-tasks__item">
              <span className="priority-tasks__rank">{index + 1}</span>
              <div className="priority-tasks__content">
                <h3>{task.wording}</h3>
                <p className="priority-tasks__reason">{assessment?.reasoning || "Review the available evidence and explanation for this task."}</p>
                <div className="priority-tasks__actions">
                  <span className="priority-tasks__score">{score.toFixed(2)} <small>/ 1.0</small></span>
                  <Button variant="outline" className="task-details-button" onClick={() => setSelectedId(task.id)}>View details</Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <TaskDetailsDrawer selectedTask={selected?.task ?? null} selectedAssessment={selected?.assessment ?? null} onClose={() => setSelectedId(null)} />
    </Card>
  );
}
