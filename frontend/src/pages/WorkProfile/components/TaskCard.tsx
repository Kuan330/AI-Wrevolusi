import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABEL } from "@/constants/taskStatus";
import type { Task } from "@/types/task";

interface TaskCardProps {
  task: Task;
  onDelete: (taskId: string) => Promise<void> | void;
}

const TaskCard = ({ task, onDelete }: TaskCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{task.title}</CardTitle>
          <Badge variant="outline">{TASK_STATUS_LABEL[task.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Exposure: {task.exposure?.replaceAll("_", " ") ?? "not assessed"}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void onDelete(task.id);
          }}
          aria-label="Delete task"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default TaskCard;
