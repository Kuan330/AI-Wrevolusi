/** Convert a 0–1 exposure score to a whole-number percentage. */
export const scoreToPercent = (score: number): number =>
  Math.round(Math.min(1, Math.max(0, score)) * 100);

export const formatScorePercent = (score: number | null | undefined): string =>
  typeof score === "number" && Number.isFinite(score)
    ? `${scoreToPercent(score)}%`
    : "—";
