export const calculateCompletionRate = (completed: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  return (completed / total) * 100;
};

export const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
};
