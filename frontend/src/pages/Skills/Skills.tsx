import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { ExternalLink } from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import CapabilityReviewDialog from "@/pages/Analysis/components/CapabilityReviewDialog";
import SkillDetailWorkspace from "@/pages/Skills/components/SkillDetailWorkspace";
import SkillDirectionBoard from "@/pages/Skills/components/SkillDirectionBoard";
import SkillMapOverview from "@/pages/Skills/components/SkillMapOverview";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import {
  readConfirmedAnalysis,
  saveConfirmedCapabilityProfile,
} from "@/pages/WorkProfile/userProfile";
import { capabilityService } from "@/services/capabilityService";
import { referenceService } from "@/services/referenceService";
import type {
  ConfirmedCapabilityProfile,
  ConfirmedTaskCapabilityRecognitionBatchResponse,
} from "@/types/capability";
import type { WefSkill } from "@/types/reference";
import "@/pages/Skills/skills.css";

const WEF_SOURCE = "https://www.weforum.org/publications/the-future-of-jobs-report-2025/";

const Skills = () => {
  const analysis = readConfirmedAnalysis();
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recognition, setRecognition] =
    useState<ConfirmedTaskCapabilityRecognitionBatchResponse | null>(null);
  const [recognitionLoading, setRecognitionLoading] = useState(Boolean(analysis));
  const [confirmedProfile, setConfirmedProfile] =
    useState<ConfirmedCapabilityProfile | null>(() => analysis?.capabilityProfile ?? null);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void referenceService
      .wefSkills()
      .then((rows) => {
        if (cancelled) return;
        setSkills([...rows].sort((left, right) => left.wef_skill_id - right.wef_skill_id));
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("The skill framework could not be loaded. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!analysis) return;
    let cancelled = false;
    const exposureStateByTaskId = new Map(
      analysis.taskExposureAssessments.map((assessment) => [
        assessment.task_id,
        assessment.suggested_state,
      ]),
    );

    void capabilityService
      .recognizeConfirmedTasks({
        confirmed_tasks: analysis.tasks.map((task) => ({
          task_id: task.id,
          task_text: task.wording,
          exposure_state: exposureStateByTaskId.get(task.id) ?? null,
        })),
      })
      .then((response) => {
        if (!cancelled) setRecognition(response);
      })
      .catch(() => {
        if (!cancelled) setRecognition(null);
      })
      .finally(() => {
        if (!cancelled) setRecognitionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [analysis]);

  const evidence = useMemo(
    () => {
      const skillById = new Map(skills.map((skill) => [skill.wef_skill_id, skill]));
      const taskById = new Map((analysis?.tasks ?? []).map((task) => [task.id, task]));
      const confirmedEvidence = (confirmedProfile?.capabilities ?? [])
        .map((capability) => ({
          skill: capability.wefSkillId === null ? null : skillById.get(capability.wefSkillId),
          tasks: capability.linkedTaskIds.flatMap((taskId) => {
            const task = taskById.get(taskId);
            return task ? [task] : [];
          }),
        }))
        .filter((item): item is ReturnType<typeof buildSkillEvidence>[number] => Boolean(item.skill));

      return confirmedEvidence.length > 0
        ? confirmedEvidence
        : buildSkillEvidence(analysis?.tasks ?? [], skills);
    },
    [analysis?.tasks, confirmedProfile, skills],
  );
  const activeSelectedSkillId = evidence.some(
    ({ skill }) => skill.wef_skill_id === selectedSkillId,
  )
    ? selectedSkillId
    : evidence[0]?.skill.wef_skill_id ?? null;

  if (!analysis) {
    return <Navigate to={ROUTES.workProfile} replace />;
  }

  const selectFromMap = (skillId: number) => {
    setSelectedSkillId(skillId);
    window.requestAnimationFrame(() => {
      document.getElementById("identified-skills")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <div className="skills-page mx-auto w-full max-w-[1180px] space-y-6 pb-10">
      <PageHeader
        title="Skills connected to your work"
        description={`See the skills reflected across your confirmed tasks for ${analysis.occupationTitle}, and how their value may change in the future.`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline" className="profile-outline-btn rounded-full">
              <Link to={ROUTES.task}>Edit tasks</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="profile-outline-btn rounded-full"
              onClick={() => setReviewOpen(true)}
            >
              {recognitionLoading ? "Loading suggestions…" : "Review capabilities"}
            </Button>
            <Button asChild className="profile-gradient-btn rounded-full font-normal">
              <Link to={ROUTES.aiExposure}>AI exposure</Link>
            </Button>
          </div>
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <section
          className="skills-glass-card grid gap-4 p-6 lg:grid-cols-2"
          aria-label="Loading skills"
        >
          <div className="space-y-4">
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/65" />
            <div className="h-20 max-w-sm animate-pulse rounded-2xl bg-white/65" />
            <div className="h-32 animate-pulse rounded-2xl bg-white/55" />
          </div>
          <div className="min-h-80 animate-pulse rounded-2xl bg-white/55" />
        </section>
      ) : (
        <>
          <SkillMapOverview
            skills={skills}
            evidence={evidence}
            taskCount={analysis.tasks.length}
            selectedSkillId={activeSelectedSkillId}
            onSelectSkill={selectFromMap}
          />

          <SkillDetailWorkspace
            evidence={evidence}
            selectedSkillId={activeSelectedSkillId}
            onSelectSkill={setSelectedSkillId}
          />

          <SkillDirectionBoard
            evidence={evidence}
            occupationTitle={analysis.occupationTitle}
          />

        </>
      )}

      <Accordion type="single" collapsible className="skills-notes">
        <AccordionItem value="tasks" className="border-white/70">
          <AccordionTrigger className="text-[#3d5f7a] hover:no-underline">
            Why we start from your tasks, not your job title
          </AccordionTrigger>
          <AccordionContent className="max-w-3xl text-sm leading-6 text-[#574a55]">
            Job titles describe where someone works, but tasks show what they actually do.
            Starting from your confirmed tasks makes each identified skill traceable to work
            you recognise.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="method" className="border-white/70">
          <AccordionTrigger className="text-[#3d5f7a] hover:no-underline">
            Method and limitations
          </AccordionTrigger>
          <AccordionContent className="max-w-3xl space-y-2 text-sm leading-6 text-[#574a55]">
            <p>
              Confirmed task wording is connected to the WEF skill list using transparent
              matching rules. A skill appears in your profile only when at least one task
              supports it.
            </p>
            <p>
              Future-use percentages and GenAI capacity describe global employer expectations
              and skill-group patterns. They are not personal scores, Malaysia-specific job
              forecasts, or predictions that your work will be replaced.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="source" className="border-0">
          <AccordionTrigger className="text-[#3d5f7a] hover:no-underline">
            Source
          </AccordionTrigger>
          <AccordionContent className="text-sm leading-6 text-[#574a55]">
            <a
              href={WEF_SOURCE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#3d5f7a] underline underline-offset-2"
            >
              World Economic Forum, Future of Jobs Report 2025
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {reviewOpen ? (
        <CapabilityReviewDialog
          open
          tasks={analysis.tasks}
          recognition={recognition}
          savedProfile={confirmedProfile}
          onClose={() => setReviewOpen(false)}
          onSave={(profile) => {
            if (saveConfirmedCapabilityProfile(profile)) setConfirmedProfile(profile);
          }}
        />
      ) : null}
    </div>
  );
};

export default Skills;
