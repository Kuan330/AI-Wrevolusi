import { ILO_OCCUPATION_EXPOSURES, IloOccupationExposure } from "@/pages/Analysis/lib/iloExposure";
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

/** Short plain-language label for occupation exposure on the compare pies. */
export const plainOccupationBandLabel = (
  potential25: string | null | undefined,
): string | null => {
  switch (potential25) {
    case IloOccupationExposure.NotExposed:
      return "Little GenAI automation potential in this job";
    case IloOccupationExposure.MinimalExposure:
      return "Mostly low GenAI automation potential";
    case IloOccupationExposure.Gradient1:
      return "Some tasks may use GenAI more than others";
    case IloOccupationExposure.Gradient2:
      return "Mixed GenAI potential across tasks";
    case IloOccupationExposure.Gradient3:
      return "Many tasks have meaningful GenAI potential";
    case IloOccupationExposure.Gradient4:
      return "High GenAI potential across most tasks";
    default:
      return null;
  }
};
