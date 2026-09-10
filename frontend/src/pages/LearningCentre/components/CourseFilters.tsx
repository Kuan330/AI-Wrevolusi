import { useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { FormSelect } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import type { Course, CourseFilters as Filters } from "../types";
export const emptyFilters: Filters = {
  query: "",
  level: "",
  provider: "",
  format: "",
  language: "",
  registration: "",
};
export type CourseFiltersProps = {
  value: Filters;
  courses: Course[];
  onChange: (value: Filters) => void;
};
export default function CourseFilters(props: CourseFiltersProps) {
  const { value, courses, onChange } = props;
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const groups = [
    {
      key: "level",
      label: "Level",
      options: ["beginner", "intermediate", "advanced", "unknown"],
    },
    ...(["provider", "format", "language"] as const).map((key) => ({
      key,
      label: key[0].toUpperCase() + key.slice(1),
      options: [...new Set(courses.map((course) => course[key]))],
    })),
    {
      key: "registration",
      label: "Registration",
      options: ["required", "not-required"],
    },
  ] as const;
  const active = groups.filter((group) => value[group.key]);
  const extraCount = active.filter((group) => group.key !== "level").length;
  const optionLabel = (option: string) =>
    option === "unknown"
      ? "Not stated"
      : option === "required"
        ? "Free account required"
        : option === "not-required"
          ? "No account required"
          : option;
  const select = (group: (typeof groups)[number]) => (
    <FormSelect
      value={value[group.key]}
      onValueChange={(next) => onChange({ ...value, [group.key]: next })}
      label={group.label}
      placeholder={group.key === "level" ? "All levels" : "All"}
      options={[
        { value: "", label: group.key === "level" ? "All levels" : "All" },
        ...group.options.map((option) => ({
          value: option,
          label: optionLabel(option),
        })),
      ]}
    />
  );
  return (
    <div className="library-filters library-glass">
      <div className="library-search-toolbar">
        <SearchField
          value={value.query}
          onChange={(query) => onChange({ ...value, query })}
          label="Search courses, providers or keywords"
          placeholder="Search courses, providers or keywords…"
        />
        <div className="library-level">{select(groups[0])}</div>
        <Button
          variant="outline"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded(!expanded)}
        >
          More filters{extraCount ? ` · ${extraCount}` : ""}
          <ChevronDown size={16} className={expanded ? "rotate-180" : ""} />
        </Button>
      </div>
      {expanded && (
        <div id={panelId} className="library-extra-filters">
          {groups.slice(1).map((group) => (
            <label key={group.key}>
              <span>{group.label}</span>
              {select(group)}
            </label>
          ))}
        </div>
      )}
      {(active.length > 0 || value.query) && (
        <div className="library-active-filters">
          {active.map((group) => (
            <Button
              key={group.key}
              size="sm"
              variant="outline"
              aria-label={`Remove ${group.label} filter`}
              onClick={() => onChange({ ...value, [group.key]: "" })}
            >
              {group.label}: {optionLabel(value[group.key])}
              <X size={12} />
            </Button>
          ))}
          <Button
            variant="link"
            size="sm"
            onClick={() => onChange({ ...emptyFilters })}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
