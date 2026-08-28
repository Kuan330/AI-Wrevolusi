import { useState } from "react";

import { Button } from "@/components/ui/button";
import TaskCard from "@/pages/WorkProfile/components/TaskCard";
import { useTasks } from "@/hooks/useTasks";
import { validateTaskTitle } from "@/utils/validation";

const TaskList = () => {
  const { tasks, addTask, removeTask } = useTasks();
  const [newTask, setNewTask] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAddTask = () => {
    const validationError = validateTaskTitle(newTask);
    if (validationError) {
      setError(validationError);
      return;
    }

    addTask(newTask.trim());
    setNewTask("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Add task</p>
        <div className="flex flex-col gap-2 sm:flex-row">
                  <input
            value={newTask}
            onChange={(event) => setNewTask(event.target.value)}
            placeholder="e.g. Coach new staff on customer service"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button onClick={handleAddTask}>Add</Button>
        </div>
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="grid gap-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onDelete={removeTask} />
        ))}
      </div>
    </div>
  );
};

export default TaskList;
