export const validateTaskTitle = (title: string): string | null => {
  if (!title.trim()) {
    return "Task title cannot be empty.";
  }

  if (title.trim().length < 4) {
    return "Task title should be at least 4 characters.";
  }

  return null;
};
