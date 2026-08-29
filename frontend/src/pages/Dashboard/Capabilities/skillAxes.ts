export const USE_TRENDS = [
  { id: "increasing", label: "Increasing use", color: "#8EC8E6" },
  { id: "stable", label: "Stable use", color: "#6FBFB0" },
  { id: "decreasing", label: "Decreasing use", color: "#A88BB8" },
] as const;

export const AI_CAPACITIES = [
  { id: "very_low", label: "Very low capacity", color: "#3D8FD6" },
  { id: "low", label: "Low capacity", color: "#8EC8E6" },
  { id: "moderate", label: "Moderate capacity", color: "#C9B06A" },
  { id: "high", label: "High capacity", color: "#8B6B2E" },
] as const;

export type UseTrendId = (typeof USE_TRENDS)[number]["id"];
export type AiCapacityId = (typeof AI_CAPACITIES)[number]["id"];

export const useTrendFromNetIncrease = (net: number | null | undefined): UseTrendId => {
  if (typeof net !== "number" || net < 0) return "decreasing";
  if (net <= 20) return "stable";
  return "increasing";
};

export const aiCapacityFromCategory = (value: string | null | undefined): AiCapacityId | null => {
  if (!value || value === "Not shown") return null;
  if (value === "Very Low-Low") return "very_low";
  if (value === "Low") return "low";
  if (value === "Low-Moderate" || value === "Moderate") return "moderate";
  if (value === "Moderate-High") return "high";
  return null;
};
