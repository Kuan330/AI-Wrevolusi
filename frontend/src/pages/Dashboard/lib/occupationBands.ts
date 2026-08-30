import {
  OccupationBandColor,
  OccupationBandId,
  OCCUPATION_BAND_COLOR,
} from "@/pages/Dashboard/lib/palette";

export { OccupationBandId, OccupationBandColor, OCCUPATION_BAND_COLOR };

export const OCCUPATION_BANDS = [
  { value: OccupationBandId.NotExposed, label: "Little AI change", color: OCCUPATION_BAND_COLOR[OccupationBandId.NotExposed] },
  { value: OccupationBandId.MinimalExposure, label: "Light AI change", color: OCCUPATION_BAND_COLOR[OccupationBandId.MinimalExposure] },
  { value: OccupationBandId.Gradient1, label: "Some AI change", color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient1] },
  { value: OccupationBandId.Gradient2, label: "Moderate AI change", color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient2] },
  { value: OccupationBandId.Gradient3, label: "High AI change", color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient3] },
  { value: OccupationBandId.Gradient4, label: "Highest AI change", color: OCCUPATION_BAND_COLOR[OccupationBandId.Gradient4] },
] as const;

export const occupationBandFromPotential = (potential25: string | null) =>
  OCCUPATION_BANDS.find((band) => band.value === potential25) ?? null;
