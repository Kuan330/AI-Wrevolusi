export const TIME_SPENT_OPTIONS = [
  { value: "", label: "Skip" },
  { value: "daily", label: "Daily" },
  { value: "several_times_a_week", label: "Several times a week" },
  { value: "weekly", label: "Weekly" },
  { value: "occasionally", label: "Occasionally" },
] as const;

export const RESPONSIBILITY_OPTIONS = [
  { value: "", label: "Skip" },
  { value: "individual", label: "I do this myself" },
  { value: "shared", label: "Shared with others" },
  { value: "lead", label: "I lead others" },
] as const;

export const createTaskId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const optionLabel = (
  options: readonly { value: string; label: string }[],
  value: string,
) => options.find((option) => option.value === value)?.label ?? "";
