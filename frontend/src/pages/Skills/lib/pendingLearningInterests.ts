import type { SpecialistEntry } from "@/features/journey/specialistSkills";
import type { PersonalSkill } from "@/features/journey/journey";

type Task = { id: string; wording: string };
/** Only carry unsaved interests whose task context and checked source are still current. */
export function pendingLearningInterests(input: {
  tasks: readonly Task[];
  tasksConfirmed: boolean;
  occupationCode: string | null;
  specialist: readonly SpecialistEntry[];
  personal: readonly PersonalSkill[];
  sourceVersion: string | null;
  goalSourceKeys: readonly string[];
}) {
  const hasTask = (id: string, wording: string) => input.tasksConfirmed && input.tasks.some(task => task.id === id && task.wording === wording);
  const specialistPending = input.specialist.filter(entry => entry.wantsLearning && !input.goalSourceKeys.includes(`specialist:${JSON.stringify([entry.taskId, entry.skillUri])}`));
  const personalPending = input.personal.filter(entry => entry.wantsLearning && !input.goalSourceKeys.includes(`personal:${entry.id}`));
  const currentSpecialist = specialistPending.filter(entry => entry.occupationCode === input.occupationCode && hasTask(entry.taskId, entry.taskWording));
  const specialist = currentSpecialist.filter(entry => input.sourceVersion !== null && entry.sourceVersion === input.sourceVersion);
  const personal = personalPending.filter(entry => entry.taskIds.every((id, index) => hasTask(id, entry.taskLabels[index])));
  const checking = input.sourceVersion === null ? currentSpecialist.length : 0;
  return { specialist, personal, checking, stale: specialistPending.length + personalPending.length - specialist.length - personal.length - checking };
}
