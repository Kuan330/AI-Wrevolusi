import type { ComponentProps, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import TaskDetailsDrawer from "@/pages/Analysis/components/TaskDetailsDrawer";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScoreRangeSlider from "@/components/ui/score-range-slider";
import AnalysisCard from "@/pages/Analysis/components/AnalysisCard";
import {
  taskScore,
  taskIsWithinScoreRange,
  type TaskScoreRange,
} from "@/pages/Analysis/lib/taskScore";
import type { ProfileTask } from "@/features/work-profile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { formatScorePercent } from "@/lib/scorePercent";
import { cn } from "@/lib/utils";

type Props = {
  tasks: ProfileTask[];
  assessments: ConfirmedTaskExposureAssessment[];
  range: TaskScoreRange;
  onRangeChange: (range: TaskScoreRange) => void;
  skillFilterLabel?: string | null;
};

export default function ExposureTaskList(props: Props) {
  const {
    tasks,
    assessments,
    range,
    onRangeChange,
    skillFilterLabel = null,
  } = props;
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () =>
      setCanScrollDown(
        list.scrollHeight - list.clientHeight - list.scrollTop > 2,
      );
    const resize = new ResizeObserver(update);
    const observeCards = () => {
      resize.disconnect();
      resize.observe(list);
      Array.from(list.children).forEach((card) => resize.observe(card));
      update();
    };
    const mutation = new MutationObserver(observeCards);
    mutation.observe(list, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    list.addEventListener("scroll", update, { passive: true });
    observeCards();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      list.removeEventListener("scroll", update);
    };
  }, []);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const detailsTask = tasks.find((task) => task.id === detailsId) ?? null;
  const byId = new Map(assessments.map((item) => [item.task_id, item]));
  const fullRange = range[0] === 0 && range[1] === 1;
  const visible = tasks
    .map((task) => ({ task, score: taskScore(task, byId.get(task.id)) }))
    .filter(({ score }) =>
      score == null ? fullRange : taskIsWithinScoreRange(score, range),
    )
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const analysisCardProps1 = {
    eyebrow: "Compare your tasks",
    title: "Your task exposure",
    description: skillFilterLabel
      ? `Highest scores first. Showing tasks linked to ${skillFilterLabel}.`
      : "Highest scores first. Select a skill on the left to filter tasks.",
    className: "exposure-task-list",
    id: "exposure-task-list-card",
  } satisfies Partial<ComponentProps<typeof AnalysisCard>>;
  const scoreRangeSliderProps2 = {
    value: range,
    onValueChange: onRangeChange,
    onReset: () => onRangeChange([0, 1]),
  } satisfies Partial<ComponentProps<typeof ScoreRangeSlider>>;
  const taskDetailsDrawerProps5 = {
    selectedTask: detailsTask,
    selectedAssessment: detailsTask ? (byId.get(detailsTask.id) ?? null) : null,
    onClose: () => setDetailsId(null),
  } satisfies Partial<ComponentProps<typeof TaskDetailsDrawer>>;
  return (
    <AnalysisCard {...analysisCardProps1}>
      <details open className="guide-disclosure mb-5">
        <summary>
          Filter by score
          {fullRange
            ? ""
            : ` · ${formatScorePercent(range[0])}–${formatScorePercent(range[1])}`}
        </summary>
        <div className="mt-3">
          <ScoreRangeSlider {...scoreRangeSliderProps2} />
        </div>
      </details>
      <p className="mb-3 text-xs text-[#7f7280]" aria-live="polite">
        Showing {visible.length} of {tasks.length} tasks
        {skillFilterLabel ? ` · ${skillFilterLabel}` : ""}
      </p>
      <div
        ref={listRef}
        className="exposure-task-scroll analysis-list-scroll space-y-1.5"
        role="region"
        aria-label="Assessed tasks"
        tabIndex={0}
      >
        {visible.map(({ task, score }) => {
          const openDetails = () => setDetailsId(task.id);
          const buttonProps4 = {
            type: "button",
            variant: "outline",
            size: "sm",
            className: "exposure-task__detail-btn ml-auto",
            onClick: (event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              openDetails();
            },
            "aria-haspopup": "dialog",
          } satisfies Partial<ComponentProps<typeof Button>>;
          return (
            <article
              key={task.id}
              className="exposure-task is-openable"
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`Open details for ${task.wording}`}
              onClick={openDetails}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetails();
                }
              }}
            >
              <h3 className="exposure-task__title">{task.wording}</h3>
              {score == null && (
                <p className="mt-1.5 text-xs text-[#7f7280]">
                  No reliable exposure score available.
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
                <Button {...buttonProps4}>Detail</Button>
              </div>
            </article>
          );
        })}
      </div>
      {visible.length > 0 && (
        <Button
          {...({
            type: "button",
            variant: "ghost",
            size: "icon",
            className: cn(
              "mx-auto mt-2 h-7 w-9 shrink-0 text-[#4f91ba] hover:bg-[#eaf3fb]",
              !canScrollDown && "invisible",
            ),
            "aria-label": "Scroll down to more tasks",
            disabled: !canScrollDown,
            "aria-hidden": !canScrollDown,
            onClick: () => {
              const list = listRef.current;
              list?.scrollBy({
                top: Math.max(120, list.clientHeight * 0.65),
                behavior: "smooth",
              });
            },
          } satisfies Partial<ComponentProps<typeof Button>>)}
        >
          <ChevronDown
            {...({
              className: "size-4",
              "aria-hidden": "true",
            } satisfies Partial<ComponentProps<typeof ChevronDown>>)}
          />
        </Button>
      )}
      {!visible.length && (
        <div className="py-6 text-sm text-[#7f7280]">
          <p>
            {tasks.length
              ? skillFilterLabel
                ? "No tasks match this skill and score range."
                : "No tasks match this range."
              : "Add a task in your profile to get started."}
          </p>
          {tasks.length > 0 && (
            <Button
              {...({
                variant: "link",
                onClick: () => onRangeChange([0, 1]),
              } satisfies Partial<ComponentProps<typeof Button>>)}
            >
              Show all scores
            </Button>
          )}
        </div>
      )}
      <TaskDetailsDrawer {...taskDetailsDrawerProps5} />
    </AnalysisCard>
  );
}
