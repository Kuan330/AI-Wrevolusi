import { useEffect, useMemo, useState } from "react";

import {
  readConfirmedAnalysis,
  saveConfirmedCapabilityProfile,
} from "@/pages/Dashboard/analysisSession";
import CapabilityCard from "@/pages/Dashboard/components/CapabilityCard";
import DashboardHeader from "@/pages/Dashboard/components/DashboardHeader";
import SkillMapCard from "@/pages/Dashboard/components/SkillMapCard";
import TaskListCard from "@/pages/Dashboard/components/TaskListCard";
import TaskMixCard from "@/pages/Dashboard/components/TaskMixCard";
import { skillsForTask } from "@/pages/Dashboard/lib/matchSkills";
import { toneForSkillId, toneForTaskBand } from "@/pages/Dashboard/lib/palette";
import {
  AI_CAPACITIES,
  aiCapacityFromCategory,
  classifySkillUseTrendFromNetIncreasePercentage,
  USE_TRENDS,
} from "@/pages/Dashboard/lib/skillAxes";
import { TASK_BANDS, type TaskBandId } from "@/pages/Dashboard/lib/taskBands";
import { capabilityService } from "@/services/capabilityService";
import { referenceService } from "@/services/referenceService";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import type {
  ConfirmedCapabilityProfile,
  ConfirmedTaskCapabilityRecognitionBatchResponse,
} from "@/types/capability";
import type { WefSkill } from "@/types/reference";
import "@/pages/Dashboard/dashboard.css";

const EMPTY_CONFIRMED_TASK_EXPOSURE_ASSESSMENTS: ConfirmedTaskExposureAssessment[] = [];

const emptyCounts = () =>
  TASK_BANDS.reduce(
    (acc, band) => {
      acc[band.id] = 0;
      return acc;
    },
    {} as Record<TaskBandId, number>,
  );

const Dashboard = () => {
  const [analysis] = useState(readConfirmedAnalysis);
  const [skills, setSkills] = useState<WefSkill[]>([]);
  const [capabilityRecognition, setCapabilityRecognition] =
    useState<ConfirmedTaskCapabilityRecognitionBatchResponse | null>(null);
  const [capabilityRecognitionStatus, setCapabilityRecognitionStatus] =
    useState<"loading" | "model" | "fallback">(analysis ? "loading" : "fallback");
  const [confirmedCapabilityProfile, setConfirmedCapabilityProfile] =
    useState<ConfirmedCapabilityProfile | null>(() => analysis?.capabilityProfile ?? null);
  const [activeBand, setActiveBand] = useState<TaskBandId | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const taskExposureAssessments =
    analysis?.taskExposureAssessments ?? EMPTY_CONFIRMED_TASK_EXPOSURE_ASSESSMENTS;

  useEffect(() => {
    void referenceService.wefSkills().then(setSkills).catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (!analysis) return;
    let shouldApplyResponse = true;
    const exposureStateByTaskId = new Map(
      taskExposureAssessments.map((assessment) => [assessment.task_id, assessment.suggested_state]),
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
        if (shouldApplyResponse) {
          setCapabilityRecognition(response);
          setCapabilityRecognitionStatus("model");
        }
      })
      .catch(() => {
        if (shouldApplyResponse) {
          setCapabilityRecognition(null);
          setCapabilityRecognitionStatus("fallback");
        }
      });
    return () => {
      shouldApplyResponse = false;
    };
  }, [analysis, taskExposureAssessments]);

  const { litSkillIds, tasksBySkill } = useMemo(() => {
    if (!analysis) return { litSkillIds: [] as number[], tasksBySkill: {} as Record<number, never[]> };
    const linked: Record<number, typeof analysis.tasks> = {};
    if (confirmedCapabilityProfile) {
      for (const capability of confirmedCapabilityProfile.capabilities) {
        if (capability.wefSkillId === null) continue;
        const linkedTaskIds = new Set(capability.linkedTaskIds);
        linked[capability.wefSkillId] = analysis.tasks.filter((task) => linkedTaskIds.has(task.id));
      }
      return {
        litSkillIds: Object.keys(linked).map(Number),
        tasksBySkill: linked,
      };
    }
    if (capabilityRecognition) {
      for (const capability of capabilityRecognition.capabilities) {
        const linkedTaskIds = new Set(capability.task_evidence.map((evidence) => evidence.task_id));
        linked[capability.wef_skill_id] = analysis.tasks.filter((task) => linkedTaskIds.has(task.id));
      }
      return {
        litSkillIds: Object.keys(linked).map(Number),
        tasksBySkill: linked,
      };
    }
    for (const task of analysis.tasks) {
      for (const skill of skillsForTask(task.wording, skills)) {
        linked[skill.wef_skill_id] = [...(linked[skill.wef_skill_id] ?? []), task];
      }
    }
    return {
      litSkillIds: Object.keys(linked).map(Number),
      tasksBySkill: linked,
    };
  }, [analysis, capabilityRecognition, confirmedCapabilityProfile, skills]);

  const counts = useMemo(() => {
    const next = emptyCounts();
    for (const taskExposureAssessment of taskExposureAssessments) {
      next[taskExposureAssessment.suggested_state] += 1;
    }
    return next;
  }, [taskExposureAssessments]);

  if (!analysis) {
    return null;
  }

  const selected = skills.find((skill) => skill.wef_skill_id === selectedSkillId) ?? null;
  const skillTaskIds = selected ? (tasksBySkill[selected.wef_skill_id] ?? []).map((task) => task.id) : [];
  const activeMeta = activeBand ? TASK_BANDS.find((band) => band.id === activeBand) : null;

  const selectBand = (band: TaskBandId | null) => {
    setActiveBand(band);
    if (band) setSelectedSkillId(null);
  };

  const selectSkill = (skillId: number | null) => {
    setSelectedSkillId(skillId);
    if (skillId) setActiveBand(null);
  };

  const listTitle = selected
    ? selected.core_skill
    : activeMeta
      ? `${activeMeta.label} tasks`
      : "All tasks";

  const trendLabel = selected
    ? USE_TRENDS.find(
        (item) =>
          item.id ===
          classifySkillUseTrendFromNetIncreasePercentage(
            selected.future_net_increase_2025_2030,
          ),
      )
        ?.label
    : null;
  const capacityLabel = selected
    ? AI_CAPACITIES.find(
        (item) => item.id === aiCapacityFromCategory(selected.genai_substitution_capacity_category),
      )?.label
    : null;

  const listHint = selected
    ? [trendLabel, capacityLabel, `${skillTaskIds.length} linked tasks`].filter(Boolean).join(" · ")
    : activeMeta
      ? "Click the slice again to show all."
      : "Click a pie slice or skill bubble to filter.";

  return (
    <div className="dashboard-page">
      <DashboardHeader />

      <div id="exposure" className="dashboard-overview__grid">
        <CapabilityCard
          title={analysis.occupationTitle}
          path={analysis.occupationPath}
          potential25={analysis.potential25}
          meanScore2025={analysis.meanScore2025}
        />

        <TaskMixCard
          counts={counts}
          activeBand={activeBand}
          taskCount={analysis.tasks.length}
          onSelectBand={selectBand}
        />

        <TaskListCard
          eyebrow={selected ? "Linked tasks" : "Task list"}
          title={listTitle}
          description={listHint}
          titleTone={
            selected
              ? toneForSkillId(selected.wef_skill_id)
              : activeBand
                ? toneForTaskBand(activeBand)
                : null
          }
          tasks={
            selected
              ? analysis.tasks.filter((task) => skillTaskIds.includes(task.id))
              : analysis.tasks
          }
          taskExposureAssessments={taskExposureAssessments}
          activeBand={selected ? null : activeBand}
          highlightedIds={skillTaskIds}
          onClear={selected || activeBand ? () => {
            selectSkill(null);
            selectBand(null);
          } : undefined}
        />

        <SkillMapCard
          skills={skills}
          litSkillIds={litSkillIds}
          tasksBySkill={tasksBySkill}
          selectedSkillId={selectedSkillId}
          onSelectSkill={selectSkill}
          tasks={analysis.tasks}
          recognition={capabilityRecognition}
          recognitionStatus={capabilityRecognitionStatus}
          confirmedProfile={confirmedCapabilityProfile}
          onSaveConfirmedProfile={(profile) => {
            if (saveConfirmedCapabilityProfile(profile)) {
              setConfirmedCapabilityProfile(profile);
              setSelectedSkillId(null);
            }
          }}
        />
      </div>
    </div>
  );
};

export default Dashboard;
