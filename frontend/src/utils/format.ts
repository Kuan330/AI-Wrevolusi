export const formatPercent = (value: number): string => `${Math.round(value)}%`;

export const toHeadline = (value: string): string =>
  value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
