import { useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { FormSelect } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import type { Course, CourseFilters as Filters } from "../types";
import {
  COURSE_LEVELS,
  COURSE_LEVEL_TONE,
  courseLevelLabel,
  isCourseLevel,
} from "../lib/courseLevels";

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
      options: [...COURSE_LEVELS],
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
  const optionLabel = (key: string, option: string) => {
    if (key === "level") return courseLevelLabel(option);
    if (option === "required") return "Free account required";
    if (option === "not-required") return "No account required";
    return option;
  };

  const levelSelect = (
    <FormSelect
      value={value.level}
      onValueChange={(next) => onChange({ ...value, level: next })}
      label="Level"
      placeholder="All levels"
      triggerClassName={
        isCourseLevel(value.level)
          ? `library-level-trigger ${COURSE_LEVEL_TONE[value.level].className}`
          : "library-level-trigger"
      }
      contentClassName="library-level-menu"
      options={[
        {
          value: "",
          label: "All levels",
          className: "library-level-option library-level-option--all",
        },
        ...COURSE_LEVELS.map((level) => ({
          value: level,
          label: courseLevelLabel(level),
          className: `library-level-option ${COURSE_LEVEL_TONE[level].className}`,
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
        <div className="library-level">{levelSelect}</div>
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
              <FormSelect
                value={value[group.key]}
                onValueChange={(next) =>
                  onChange({ ...value, [group.key]: next })
                }
                label={group.label}
                placeholder="All"
                options={[
                  { value: "", label: "All" },
                  ...group.options.map((option) => ({
                    value: option,
                    label: optionLabel(group.key, option),
                  })),
                ]}
              />
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
              {group.label}: {optionLabel(group.key, value[group.key])}
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
