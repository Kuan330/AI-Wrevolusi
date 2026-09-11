import {
  AiCapacityColor,
  AiCapacityId,
  AI_CAPACITY_COLOR,
  UseTrendColor,
  UseTrendId,
  USE_TREND_COLOR,
} from "@/pages/Analysis/lib/palette";

export { AiCapacityId, UseTrendId };

export const USE_TRENDS = [
  { id: UseTrendId.Increasing, label: "Increasing use", color: USE_TREND_COLOR[UseTrendId.Increasing] },
  { id: UseTrendId.Stable, label: "Stable use", color: USE_TREND_COLOR[UseTrendId.Stable] },
  { id: UseTrendId.Decreasing, label: "Decreasing use", color: USE_TREND_COLOR[UseTrendId.Decreasing] },
] as const;

export const AI_CAPACITIES = [
  { id: AiCapacityId.VeryLow, label: "Very low capacity", color: AI_CAPACITY_COLOR[AiCapacityId.VeryLow] },
  { id: AiCapacityId.Low, label: "Low capacity", color: AI_CAPACITY_COLOR[AiCapacityId.Low] },
  { id: AiCapacityId.Moderate, label: "Moderate capacity", color: AI_CAPACITY_COLOR[AiCapacityId.Moderate] },
  { id: AiCapacityId.High, label: "High capacity", color: AI_CAPACITY_COLOR[AiCapacityId.High] },
] as const;

export const classifySkillUseTrendFromNetIncreasePercentage = (
  netIncreasePercentage: number | null | undefined,
): UseTrendId => {
  if (typeof netIncreasePercentage !== "number" || netIncreasePercentage < 0) {
    return UseTrendId.Decreasing;
  }
  if (netIncreasePercentage <= 20) return UseTrendId.Stable;
  return UseTrendId.Increasing;
};

export const aiCapacityFromCategory = (value: string | null | undefined): AiCapacityId | null => {
  if (!value || value === "Not shown") return null;
  if (value === "Very Low-Low") return AiCapacityId.VeryLow;
  if (value === "Low") return AiCapacityId.Low;
  if (value === "Low-Moderate" || value === "Moderate") return AiCapacityId.Moderate;
  if (value === "Moderate-High") return AiCapacityId.High;
  return null;
};

export { AiCapacityColor, AI_CAPACITY_COLOR, UseTrendColor, USE_TREND_COLOR };
