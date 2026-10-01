import { currentWorkKey, readJourneyProfile } from "../journey/journey.ts";
import { currentWorkspaceSession, flushWorkspace } from "../../services/accountStorage.ts";
import { exposureService } from "../../services/exposureService.ts";
import { saveConfirmedAnalysis } from "./userProfile.ts";

/** Checks confirmed work on AI impact entry or an explicit retry. */
export async function checkWorkAiFindings(): Promise<void> {
  const profile = readJourneyProfile();
  if (!profile.tasksConfirmed || !profile.tasks.length) {
    throw new Error("Confirm your profile before checking AI findings.");
  }
  const code = profile.tasksOccupationCode;
  if (!code) throw new Error("Your work is saved, but it is not linked to a research occupation yet. You can still review your skills.");
  const owner = currentWorkspaceSession();
  const workKey = currentWorkKey();
  const profileVersion = profile.profileVersion;
  const assertCurrentWork = () => {
    if (owner !== currentWorkspaceSession() || workKey !== currentWorkKey()
      || profileVersion !== readJourneyProfile().profileVersion) {
      throw new Error("Your account or work changed. Check your current profile before trying again.");
    }
  };
  await flushWorkspace();
  assertCurrentWork();
  const response = await exposureService.assessConfirmedTasksAgainstIloReferences({
    occupation_code: code,
    confirmed_tasks: profile.tasks.map((task) => ({
      task_id: task.id,
      task_text: task.wording,
      ilo_task_id: !task.sourceOccupationCode || task.sourceOccupationCode === code ? task.iloTaskId : undefined,
      context: {
        time_spent: task.timeSpent || null,
        routine_processing_level: null,
        information_use_level: null,
        human_interaction_level: null,
        judgement_level: null,
        responsibility_level: null,
      },
    })),
  });
  assertCurrentWork();
  if (response.classification_check !== "same-title-v1") {
    throw new Error("The research service has not checked the occupation classification link. Your work is saved; you can continue to skills.");
  }
  const currentReferenceTasks = profile.tasks.filter((task) => !task.sourceOccupationCode || task.sourceOccupationCode === code);
  const referenceTask = currentReferenceTasks.find((task) => typeof task.meanScore2025 === "number")
    ?? currentReferenceTasks.find((task) => task.potential25);
  const occupation = profile.occupation?.unit.occupation_code === code ? profile.occupation : null;
  saveConfirmedAnalysis({
    classificationCheck: "same-title-v1",
    occupationCode: code,
    occupationTitle: occupation?.unit.title || profile.jobTitle || "Your work",
    occupationPath: occupation?.path.map((item) => item.title) ?? [],
    potential25: referenceTask?.potential25 ?? response.assessments.find((item) => item.potential25)?.potential25 ?? null,
    meanScore2025: referenceTask?.meanScore2025 ?? null,
    tasks: profile.tasks,
    taskExposureAssessments: response.assessments,
  });
  await flushWorkspace();
  assertCurrentWork();
}
