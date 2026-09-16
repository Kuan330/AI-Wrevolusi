import type { ComponentProps } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RemoveIconButton from "@/components/ui/remove-icon-button";
import { TASK_STATUS_LABEL } from "@/constants/taskStatus";
import type { Task } from "@/types/task";

interface TaskCardProps {
  task: Task;
  onDelete: (taskId: string) => Promise<void> | void;
}

const TaskCard = (props: TaskCardProps) => {
  const { task, onDelete } = props;
  const removeProps = {
    onClick: () => {
      void onDelete(task.id);
    },
    "aria-label": "Remove task",
  } satisfies Partial<ComponentProps<typeof RemoveIconButton>>;
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
        <RemoveIconButton iconOnly {...removeProps} />
      </CardContent>
    </Card>
  );
};

export default TaskCard;
