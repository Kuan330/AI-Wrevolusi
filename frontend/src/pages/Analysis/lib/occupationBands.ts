import { ILO_OCCUPATION_EXPOSURES } from "@/pages/Analysis/lib/iloExposure";
import {
  OccupationBandColor,
  OccupationBandId,
  OccupationBandInk,
  OCCUPATION_BAND_COLOR,
  OCCUPATION_BAND_INK,
} from "@/pages/Analysis/lib/palette";

export { OccupationBandId, OccupationBandColor, OccupationBandInk, OCCUPATION_BAND_COLOR, OCCUPATION_BAND_INK };

export const OCCUPATION_BANDS = ILO_OCCUPATION_EXPOSURES.map((category) => ({
  ...category,
  label: category.value,
  color: OCCUPATION_BAND_COLOR[category.value],
  ink: OCCUPATION_BAND_INK[category.value],
}));

export const occupationBandFromPotential = (potential25: string | null | undefined) =>
  OCCUPATION_BANDS.find((band) => band.value === potential25) ?? null;
