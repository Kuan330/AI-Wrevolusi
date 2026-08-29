export const OCCUPATION_BANDS = [
  { value: "Not Exposed", label: "Little AI change", color: "#7BB8A4" },
  { value: "Minimal Exposure", label: "Light AI change", color: "#9EC9E4" },
  { value: "Exposed: Gradient 1", label: "Some AI change", color: "#F0C36A" },
  { value: "Exposed: Gradient 2", label: "Moderate AI change", color: "#E0A15A" },
  { value: "Exposed: Gradient 3", label: "High AI change", color: "#D97A5A" },
  { value: "Exposed: Gradient 4", label: "Highest AI change", color: "#C45C5C" },
] as const;

export const occupationBandFromPotential = (potential25: string | null) =>
  OCCUPATION_BANDS.find((band) => band.value === potential25) ?? null;
