export const OCCUPATION_FILTERS = [
  {
    key: "major",
    label: "Field of work",
    placeholder: "Type or select your field",
  },
  {
    key: "sub_major",
    label: "Occupation group",
    placeholder: "Type or select a group",
  },
  {
    key: "minor",
    label: "Kind of role",
    placeholder: "Type or select a role type",
  },
  {
    key: "unit",
    label: "Your occupation",
    placeholder: "Type or select your occupation",
  },
] as const;

export type OccupationFilterKey = (typeof OCCUPATION_FILTERS)[number]["key"];

export const NEXT_FILTER: Record<OccupationFilterKey, OccupationFilterKey | null> = {
  major: "sub_major",
  sub_major: "minor",
  minor: "unit",
  unit: null,
};

export const FILTER_ORDER: OccupationFilterKey[] = OCCUPATION_FILTERS.map((item) => item.key);
