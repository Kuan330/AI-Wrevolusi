import { useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProfileTask,
  TaskPractice as Practice,
  TaskTrial,
} from "@/pages/WorkProfile/types";
import {
  formatMinutes,
  qualityLabels,
  trialComparison,
} from "../lib/taskPractice";
import TrialDialog from "./TrialDialog";

export default function TaskPractice({
  task,
  onSave,
}: {
  task: ProfileTask;
  onSave: (update: (current: Practice) => Practice) => void;
}) {
  const [dialog, setDialog] = useState<TaskTrial | null>(null);
  const trials = task.practice?.trials ?? [];
  const latest = trials.find((trial) => trial.taskWording === task.wording);
  const result = latest ? trialComparison(latest) : null;
  return (
    <Card className="border-[#cfe0ed] bg-[#eaf3fb]/60 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-[#3d5f7a]">
          <Clock3 className="size-4" />
          Did AI help with this task?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[#574a55]">
        {latest ? (
          <div aria-live="polite" className="space-y-3">
            <p className="text-xs text-[#7f7280]">
              Latest trial · {new Date(latest.createdAt).toLocaleDateString()} ·{" "}
              {latest.workload}
            </p>
            <dl className="practice-comparison">
              <div>
                <dt>Usual time without AI</dt>
                <dd>
                  {latest.baselineMinutes == null
                    ? "Not recorded"
                    : `${formatMinutes(latest.baselineMinutes)} min`}
                </dd>
              </div>
              <div>
                <dt>With AI, including review</dt>
                <dd>{formatMinutes(latest.minutes)} min</dd>
              </div>
            </dl>
            <p className="font-medium">{qualityLabels[latest.quality]}</p>
            {result ? (
              <p>
                {result.difference === 0
                  ? "No change in time for this trial."
                  : `${formatMinutes(Math.abs(result.difference))} minutes ${result.difference > 0 ? "less" : "more"} (${formatMinutes(Math.abs(result.percentage))}%) than your usual time.`}{" "}
                {latest.quality !== "met"
                  ? "The result still needs improvement; less time alone does not mean a better outcome."
                  : "Record more trials to see whether this holds up."}
              </p>
            ) : (
              <p>
                {latest.baselineMinutes == null
                  ? "Your time is saved. Add a baseline when you know it to compare results."
                  : "Time comparison is unavailable because the workloads were not confirmed as similar."}
              </p>
            )}
            <Button
              variant="link"
              className="h-auto p-0 text-[#326889]"
              onClick={() => setDialog(latest)}
            >
              {latest.baselineMinutes == null
                ? "Add baseline time"
                : "Review baseline and workload"}
            </Button>
          </div>
        ) : (
          <p>
            After trying AI, record your total time and whether the result met
            your needs. Use Record a trial above; you can start without knowing
            your original time.
          </p>
        )}
        {trials.length > 0 && (
          <details className="guide-disclosure">
            <summary>View history ({trials.length})</summary>
            <ol className="mt-3 space-y-3">
              {trials.map((trial) => (
                <li key={trial.id} className="border-t border-[#cfe0ed] pt-3">
                  <p className="font-medium">
                    {formatMinutes(trial.minutes)} min ·{" "}
                    {qualityLabels[trial.quality]}
                  </p>
                  <p className="text-xs">
                    {new Date(trial.createdAt).toLocaleString()} ·{" "}
                    {trial.workload}
                  </p>
                  {trial.taskWording !== task.wording && (
                    <p className="text-xs">
                      Previous task wording: {trial.taskWording}
                    </p>
                  )}
                  <p className="text-xs">
                    Baseline:{" "}
                    {trial.baselineMinutes == null
                      ? "not recorded"
                      : `${formatMinutes(trial.baselineMinutes)} min`}{" "}
                    ·{" "}
                    {trial.sameWorkload
                      ? "Similar workload confirmed"
                      : "Workload comparison not confirmed"}
                  </p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-[#326889]"
                    onClick={() => setDialog(trial)}
                  >
                    Review baseline
                  </Button>
                </li>
              ))}
            </ol>
          </details>
        )}
        <p className="text-xs text-[#7f7280]">
          Self-reported timings, saved with your task profile. These records do not
          change your ILO exposure score.
        </p>
        {dialog && (
          <TrialDialog
            key={dialog.id}
            task={task}
            baselineTrial={dialog}
            onClose={() => setDialog(null)}
            onSave={onSave}
          />
        )}
      </CardContent>
    </Card>
  );
}
