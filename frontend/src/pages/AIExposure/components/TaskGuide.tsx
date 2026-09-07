import { ArrowLeft, Plus, Wrench } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { InfoPopover } from "@/components/ui/info-popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AnalysisCard from "@/pages/Analysis/components/AnalysisCard";
import TaskDetailsDrawer from "@/pages/Analysis/components/TaskDetailsDrawer";
import type {
  ProfileTask,
  TaskPractice as Practice,
} from "@/pages/WorkProfile/types";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import { PAGE_GRADIENT_CSS } from "@/pages/Analysis/lib/palette";
import { taskGuidance } from "../lib/taskGuidance";
import { formatMinutes, qualityLabels } from "../lib/taskPractice";
import TaskPractice from "./TaskPractice";
import TrialDialog from "./TrialDialog";

const welcomeSteps = [
  {
    title: "Explore",
    text: "See where AI could help and which tools to consider.",
  },
  { title: "Try", text: "Follow a practical plan and check the output." },
  { title: "Compare", text: "Record your time and result to see what worked." },
];
const stepTitles = [
  "Prepare your inputs",
  "Explore with AI",
  "Check and refine",
];

export default function TaskGuide({
  task,
  assessment,
  onClear,
  onSave,
}: {
  task: ProfileTask | null;
  assessment?: ConfirmedTaskExposureAssessment;
  onClear: () => void;
  onSave: (update: (current: Practice) => Practice) => void;
}) {
  const [details, setDetails] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [tab, setTab] = useState("guide");
  const guidance = task ? taskGuidance(task) : null;
  const trials = task?.practice?.trials ?? [];
  const latest = trials.find((trial) => trial.taskWording === task?.wording);

  return (
    <AnalysisCard
      id="task-guide"
      className="task-guide"
      eyebrow="Your AI task guide"
      title={
        task && guidance ? (
          <InfoPopover label="Full task description" trigger={guidance.title}>
            <p>{task.wording}</p>
          </InfoPopover>
        ) : (
          "Select a task to explore AI assistance"
        )
      }
      description={
        task ? undefined : (
          <>
            Choose a task from your list, then click{" "}
            <strong className="font-semibold text-[#3d5f7a]">
              Explore AI assistance
            </strong>
            .
          </>
        )
      }
    >
      {task && guidance ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-0 text-xs text-[#3d5f7a]"
              onClick={onClear}
            >
              <ArrowLeft className="size-3.5" />
              Overview
            </Button>
            <span className="text-xs text-[#7f7280]">
              Template guidance
              <InfoPopover label="About this guidance">
                <p>
                  Practical templates selected by task wording, not a live AI
                  analysis or an ILO recommendation. Check their relevance to
                  your work. Your notes are included in the example prompt.
                </p>
              </InfoPopover>
            </span>
          </div>
          <p className="text-sm leading-6 text-[#574a55]">{guidance.help}</p>
          <div
            className="guide-record-banner"
            style={{ background: PAGE_GRADIENT_CSS }}
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#3d5f7a]">
                {latest ? "Keep track of what works" : "Already tried AI?"}
              </h3>
              <p className="mt-1 text-xs leading-5 text-[#574a55]">
                {latest
                  ? `Latest: ${formatMinutes(latest.minutes)} min · ${qualityLabels[latest.quality]}`
                  : "Record your time and result. You can add a baseline later."}
              </p>
            </div>
            <AppButton
              tone="gradient"
              className="shrink-0"
              onClick={() => setRecordOpen(true)}
            >
              <Plus className="size-4" />
              Record a trial
            </AppButton>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList
              className="guide-tabs"
              aria-label="Task guidance and results"
            >
              <TabsTrigger value="guide">How to use AI</TabsTrigger>
              <TabsTrigger value="results">
                My results{trials.length ? ` · ${trials.length}` : ""}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="guide" className="mt-4 space-y-4">
              <section>
                <h3 className="guide-subtitle">Three steps to try</h3>
                <Accordion type="single" collapsible className="guide-steps">
                  {guidance.steps.map((step, index) => (
                    <AccordionItem
                      key={step}
                      value={String(index)}
                      className="border-[#e5dbe6] last:border-b-0"
                    >
                      <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                        <span className="flex items-center gap-3">
                          <span className="guide-step-number">{index + 1}</span>
                          <span>{stepTitles[index]}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-10 pr-3 text-[#574a55] leading-6">
                        {step}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
              <section>
                <h3 className="guide-subtitle">Tools to consider</h3>
                <dl className="guide-tools">
                  {guidance.tools.map((tool) => (
                    <div key={tool.name} className="flex gap-3">
                      <Wrench className="mt-0.5 size-4 shrink-0 text-[#4f91ba]" />
                      <div>
                        <dt className="text-sm font-medium text-[#3d5f7a]">
                          {tool.name}
                        </dt>
                        <dd className="mt-1 text-xs leading-5 text-[#7f7280]">
                          {tool.purpose}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
              <Accordion type="multiple" className="guide-extras">
                <AccordionItem value="review">
                  <AccordionTrigger className="py-3">
                    What you should check
                  </AccordionTrigger>
                  <AccordionContent className="text-[#574a55] leading-6">
                    {guidance.review}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="prompt">
                  <AccordionTrigger className="py-3">
                    Example prompt
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="whitespace-pre-wrap rounded-xl bg-[#eaf3fb]/70 p-3 text-[#574a55] leading-6">
                      {guidance.prompt}
                    </p>
                  </AccordionContent>
                </AccordionItem>
                {task.notes && (
                  <AccordionItem value="context">
                    <AccordionTrigger className="py-3">
                      Your working context
                    </AccordionTrigger>
                    <AccordionContent className="text-[#574a55]">
                      {task.notes}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
              <Button
                variant="link"
                className="h-auto p-0 text-xs text-[#326889]"
                onClick={() => setDetails(true)}
              >
                Exposure score and evidence
              </Button>
            </TabsContent>
            <TabsContent value="results" className="mt-4">
              <TaskPractice task={task} onSave={onSave} />
            </TabsContent>
          </Tabs>
          {recordOpen && (
            <TrialDialog
              task={task}
              onClose={() => setRecordOpen(false)}
              onSave={(update) => {
                onSave(update);
                setTab("results");
              }}
            />
          )}
          <TaskDetailsDrawer
            selectedTask={details ? task : null}
            selectedAssessment={assessment ?? null}
            onClose={() => setDetails(false)}
          />
        </div>
      ) : (
        <div className="space-y-4 pt-3">
          <ol
            className="overflow-hidden rounded-2xl px-4"
            style={{ background: PAGE_GRADIENT_CSS }}
          >
            {welcomeSteps.map(({ title, text }, index) => (
              <li
                key={title}
                className="flex gap-3 border-b border-[#dfdce8]/70 py-4 last:border-b-0"
              >
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/85 text-xs font-semibold tabular-nums text-[#4f91ba]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#3d5f7a]">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-[#574a55]">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="space-y-1 text-xs leading-5 text-[#7f7280]">
            <p>Start with a task you do often or find time-consuming.</p>
            <p className="font-medium text-[#3d5f7a]">
              No timing information is needed to explore.
            </p>
          </div>
        </div>
      )}
    </AnalysisCard>
  );
}
