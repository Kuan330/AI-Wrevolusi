import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { getSkillDecision, readJourneyState } from "@/features/journey/journey";
import type { TaskScoreRange } from "@/pages/Analysis/lib/taskScore";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { readConfirmedAnalysis } from "@/features/work-profile/userProfile";
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
  const [, setJourneyRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setJourneyRevision((value) => value + 1);
    window.addEventListener("workspace-change", refresh);
    return () => window.removeEventListener("workspace-change", refresh);
  }, []);

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
  const review = (() => {
    try {
      readJourneyState();
      return {
        evidence: evidence.filter(({ skill }) => getSkillDecision(skill.wef_skill_id) !== "rejected"),
        error: "",
      };
    } catch {
      return { evidence: [], error: "Your saved skill decisions could not be read. Reload your saved work before reviewing suggestions." };
    }
  })();
  const selectedEvidence =
    review.evidence.find(({ skill }) => skill.wef_skill_id === selectedSkillId) ??
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
  const buttonPropsReview = {
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
    evidence: review.evidence,
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
        title="AI impact on my work"
        description="Review the available evidence for your occupation and tasks, then check the skills suggested from your work."
        actions={
          <div className="exposure-page__actions">
            <Button {...buttonPropsEdit}>
              <Link to={ROUTES.task}>Edit tasks</Link>
            </Button>
            <Button {...buttonPropsEdit}>
              <Link to={ROUTES.workProfile}>Change occupation</Link>
            </Button>
            <Button {...buttonPropsReview}>
              <Link to={ROUTES.skills}>Review my skills</Link>
            </Button>
          </div>
        }
      />

      <div className="exposure-dashboard">
        <div className="exposure-dashboard__main">
          <ExposureCompareCard {...exposureCompareCardProps} />
          {skillsError || review.error ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
              {skillsError || review.error}
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
