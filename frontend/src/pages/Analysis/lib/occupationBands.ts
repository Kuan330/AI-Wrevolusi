import {
  OccupationBandColor,
  OccupationBandId,
  OccupationBandInk,
  OCCUPATION_BAND_COLOR,
  OCCUPATION_BAND_INK,
} from "@/pages/Analysis/lib/palette";

export { OccupationBandId, OccupationBandColor, OccupationBandInk, OCCUPATION_BAND_COLOR, OCCUPATION_BAND_INK };

export const OCCUPATION_BANDS = [
  {
    value: OccupationBandId.NotExposed,
    label: "Low AI Impact",
    description: "Work is largely unaffected by AI",
    color: OCCUPATION_BAND_COLOR[OccupationBandId.NotExposed],
    ink: OCCUPATION_BAND_INK[OccupationBandId.NotExposed],
  },
  {
    value: OccupationBandId.MinimalExposure,
    label: "AI-Assisted",
    description: "AI mainly helps improve efficiency",
    color: OCCUPATION_BAND_COLOR[OccupationBandId.MinimalExposure],
    ink: OCCUPATION_BAND_INK[OccupationBandId.MinimalExposure],
  },
  {
    value: OccupationBandId.Gradient1,
    label: "AI-Augmented",
    description: "AI participates in parts of the work",
    color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient1],
    ink: OCCUPATION_BAND_INK[OccupationBandId.Gradient1],
  },
  {
    value: OccupationBandId.Gradient2,
    label: "AI-Enhanced",
    description: "AI will noticeably change how work is done",
    color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient2],
    ink: OCCUPATION_BAND_INK[OccupationBandId.Gradient2],
  },
  {
    value: OccupationBandId.Gradient3,
    label: "Partial AI Replacement",
    description: "Some core tasks may be taken on by AI",
    color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient3],
    ink: OCCUPATION_BAND_INK[OccupationBandId.Gradient3],
  },
  {
    value: OccupationBandId.Gradient4,
    label: "High AI Replacement Potential",
    description: "Many tasks may be automated by AI",
    color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient4],
    ink: OCCUPATION_BAND_INK[OccupationBandId.Gradient4],
  },
] as const;

export const occupationBandFromPotential = (potential25: string | null | undefined) =>
  OCCUPATION_BANDS.find((band) => band.value === potential25) ?? null;
