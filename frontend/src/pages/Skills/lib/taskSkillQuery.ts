export const SKILL_QUERY_LIMIT = 300;

/** Keep the complete task. A long task needs a user's explicit search focus. */
export function prepareTaskSkillQuery(task: string) {
  return {
    fullTask: task,
    query: task.length <= SKILL_QUERY_LIMIT ? task : "",
    requiresFocus: task.length > SKILL_QUERY_LIMIT,
  };
}
