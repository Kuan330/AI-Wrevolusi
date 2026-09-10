import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import SkillDetailWorkspace from "@/pages/Skills/components/SkillDetailWorkspace";
import SkillDirectionBoard from "@/pages/Skills/components/SkillDirectionBoard";
import SkillMapOverview from "@/pages/Skills/components/SkillMapOverview";
import { buildSkillEvidence } from "@/pages/Skills/lib/skillProfile";
import { readConfirmedAnalysis } from "@/pages/WorkProfile/userProfile";
import { referenceService } from "@/services/referenceService";
import type { WefSkill } from "@/types/reference";
import "@/pages/Skills/skills.css";

const Skills = () => {
  const { hash } = useLocation();
  const analysis = readConfirmedAnalysis();
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          setLoadError(
            "The skill framework could not be loaded. Please try again.",
          );
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
    if (loading || loadError || hash !== "#skill-directions") return;
    const frame = requestAnimationFrame(() => {
      const section =
        document.getElementById("skill-directions") ??
        document.getElementById("identified-skills");
      section?.scrollIntoView({ behavior: "instant", block: "start" });
      section?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, loading, loadError]);

  const evidence = useMemo(
    () => buildSkillEvidence(analysis?.tasks ?? [], skills),
    [analysis?.tasks, skills],
  );
  const activeSelectedSkillId = evidence.some(
    ({ skill }) => skill.wef_skill_id === selectedSkillId,
  )
    ? selectedSkillId
    : (evidence[0]?.skill.wef_skill_id ?? null);

  if (!analysis) {
    const navigateProps1 = {
      to: ROUTES.workProfile,
      replace: true,
    } satisfies Partial<ComponentProps<typeof Navigate>>;
    return <Navigate {...navigateProps1} />;
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

  const buttonProps2 = {
    asChild: true,
    variant: "outline",
    className: "profile-outline-btn rounded-full",
  } satisfies Partial<ComponentProps<typeof Button>>;
  const buttonProps3 = {
    asChild: true,
    className: "profile-gradient-btn rounded-full font-normal",
  } satisfies Partial<ComponentProps<typeof Button>>;
  return (
    <div className="skills-page mx-auto w-full max-w-[1180px] space-y-6 pb-10">
      <PageHeader
        title="Skills connected to your work"
        description={`See the skills reflected across your confirmed tasks for ${analysis.occupationTitle}, and how their value may change in the future.`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button {...buttonProps2}>
              <Link to={ROUTES.task}>Edit tasks</Link>
            </Button>
            <Button {...buttonProps3}>
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
            {...({
              skills: skills,
              evidence: evidence,
              taskCount: analysis.tasks.length,
              selectedSkillId: activeSelectedSkillId,
              onSelectSkill: selectFromMap,
            } satisfies Partial<ComponentProps<typeof SkillMapOverview>>)}
          />

          <SkillDetailWorkspace
            {...({
              evidence: evidence,
              selectedSkillId: activeSelectedSkillId,
              onSelectSkill: setSelectedSkillId,
            } satisfies Partial<ComponentProps<typeof SkillDetailWorkspace>>)}
          />

          <SkillDirectionBoard
            {...({
              evidence: evidence,
              occupationTitle: analysis.occupationTitle,
            } satisfies Partial<ComponentProps<typeof SkillDirectionBoard>>)}
          />
        </>
      )}
    </div>
  );
};

export default Skills;
