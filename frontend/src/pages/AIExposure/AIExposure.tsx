import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import ExposureCompareCard from "./components/ExposureCompareCard";
import ExposureSkillCloud from "./components/ExposureSkillCloud";
import ExposureTaskList from "./components/ExposureTaskList";
import ScoreInfoModal from "./components/ScoreInfoModal";
import { exposureCompareInsight } from "./lib/exposureCompare";
import { taskOverview } from "./lib/taskOverview";
import "@/pages/Analysis/analysis.css";
import "./exposure.css";

export default function AIExposure() {
  const analysis = readConfirmedAnalysis();
  const [scoreRange, setScoreRange] = useState<TaskScoreRange>([0, 1]);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [scoreInfoOpen, setScoreInfoOpen] = useState(false);
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void referenceService
      .wefSkills()
      .then((rows) => {
        if (cancelled) return;
        setSkills(
          [...rows].sort(
            (left, right) => left.wef_skill_id - right.wef_skill_id,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSkillsError(
            "The skill framework could not be loaded. Please try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const evidence = useMemo(
    () => buildSkillEvidence(analysis?.tasks ?? [], skills),
    [analysis?.tasks, skills],
  );
  const selectedEvidence =
    evidence.find(({ skill }) => skill.wef_skill_id === selectedSkillId) ??
    null;
  const activeSkillId = selectedEvidence?.skill.wef_skill_id ?? null;
  const filteredTasks = selectedEvidence
    ? selectedEvidence.tasks
    : (analysis?.tasks ?? []);

  if (!analysis) {
    return (
      <Navigate
        {...({ to: ROUTES.workProfile, replace: true } satisfies Partial<
          ComponentProps<typeof Navigate>
        >)}
      />
    );
  }

  const assessments = analysis.taskExposureAssessments ?? [];
  const overview = taskOverview(analysis.tasks, assessments);
  const insight = exposureCompareInsight({
    occupationScore: analysis.meanScore2025,
    overview,
  });
  const buttonPropsChange = {
    asChild: true,
    className: "profile-gradient-btn rounded-full font-normal",
  } satisfies Partial<ComponentProps<typeof Button>>;
  const buttonPropsEdit = {
    asChild: true,
    variant: "outline",
    className: "profile-outline-btn rounded-full",
  } satisfies Partial<ComponentProps<typeof Button>>;
  const exposureCompareCardProps = {
    occupationTitle: analysis.occupationTitle,
    potential25: analysis.potential25,
    insight,
    onOpenDetails: () => setScoreInfoOpen(true),
    onViewTasks: () => {
      setSelectedSkillId(null);
      setScoreRange([0, 1]);
      requestAnimationFrame(() => {
        document.getElementById("task-list")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
  } satisfies Partial<ComponentProps<typeof ExposureCompareCard>>;
  const exposureSkillCloudProps = {
    skills,
    evidence,
    selectedSkillId: activeSkillId,
    onSelectSkill: setSelectedSkillId,
  } satisfies Partial<ComponentProps<typeof ExposureSkillCloud>>;
  const exposureTaskListProps = {
    tasks: filteredTasks,
    assessments,
    range: scoreRange,
    onRangeChange: setScoreRange,
    skillFilterLabel: selectedEvidence?.skill.core_skill ?? null,
  } satisfies Partial<ComponentProps<typeof ExposureTaskList>>;
  const scoreInfoModalProps = {
    open: scoreInfoOpen,
    onOpenChange: setScoreInfoOpen,
  } satisfies Partial<ComponentProps<typeof ScoreInfoModal>>;

  return (
    <div className="analysis-page exposure-page mx-auto w-full max-w-[1400px]">
      <PageHeader
        className="exposure-page__header flex-col items-start sm:flex-row sm:items-center"
        title="AI Impact on Your Role, Tasks and Skills"
        description="Compare occupation and task exposure, see skills in your work, then prioritise where to try AI."
        actions={
          <div className="exposure-page__actions">
            <Button {...buttonPropsChange}>
              <Link to={ROUTES.workProfile}>Change occupation</Link>
            </Button>
            <Button {...buttonPropsEdit}>
              <Link to={ROUTES.task}>Edit tasks</Link>
            </Button>
          </div>
        }
      />

      <div className="exposure-dashboard">
        <div className="exposure-dashboard__main">
          <ExposureCompareCard {...exposureCompareCardProps} />
          {skillsError ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
              {skillsError}
            </div>
          ) : skillsLoading ? (
            <section
              className="exposure-glass-card min-h-72 animate-pulse p-6"
              aria-label="Loading skills"
            />
          ) : (
            <ExposureSkillCloud {...exposureSkillCloudProps} />
          )}
        </div>
        <aside id="task-list" className="exposure-dashboard__tasks scroll-mt-24">
          <ExposureTaskList {...exposureTaskListProps} />
        </aside>
      </div>

      <ScoreInfoModal {...scoreInfoModalProps} />
    </div>
  );
}
