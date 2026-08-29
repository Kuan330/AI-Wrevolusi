import { CASCADE_LEVELS } from "../../constants";
import { listOccupations } from "../../api/occupations";

const EMPTY = {
  selected: { major: null, sub_major: null, minor: null, unit: null },
  options: { major: [], sub_major: [], minor: [], unit: [] },
};

export function emptyCascade() {
  return {
    selected: { ...EMPTY.selected },
    options: { major: [], sub_major: [], minor: [], unit: [] },
  };
}

export function nextLevel(level) {
  const i = CASCADE_LEVELS.findIndex((l) => l.id === level);
  return i >= 0 ? CASCADE_LEVELS[i + 1]?.id || null : null;
}

export async function loadMajorsInto(setCascade) {
  const majors = await listOccupations();
  setCascade({
    selected: { major: null, sub_major: null, minor: null, unit: null },
    options: { major: majors, sub_major: [], minor: [], unit: [] },
  });
  return majors;
}

export function OccupationCascade({ cascade, onChange, disabled }) {
  return (
    <div className="cascade">
      {CASCADE_LEVELS.map((level, i) => {
        const prev = CASCADE_LEVELS[i - 1];
        const locked = Boolean(disabled) || (prev && !cascade.selected[prev.id]);
        const selected = cascade.selected[level.id];
        return (
          <label className="field" key={level.id}>
            {level.label}
            <select
              value={selected?.occupation_code || ""}
              disabled={locked}
              onChange={(e) => onChange(level.id, e.target.value)}
            >
              <option value="">{level.placeholder}</option>
              {cascade.options[level.id].map((o) => (
                <option key={o.occupation_code} value={o.occupation_code}>
                  {o.occupation_code} · {o.title}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
