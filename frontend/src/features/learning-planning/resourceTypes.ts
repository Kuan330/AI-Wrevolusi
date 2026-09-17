export type Resource = {
  id: string;
  title: string;
  provider: string;
  url: string;
  summary: string;
  minutes?: number;
  format: "Module" | "Course";
  tags: string[];
  access: string;
};

export type Selection = {
  resourceId: string;
  themeTitle: string;
  skillName: string;
  addedAt: string;
  chapterNames?: string[];
  weekdays?: number[];
  minutesPerDay?: number;
  startTime?: string;
  endTime?: string;
  totalMinutes?: number | null;
  startDate?: string;
  scheduleMode?: "later" | "routine";
};
