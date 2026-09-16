import { ArrowRight, BookOpen, Clock3, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { TimePicker } from "@/components/ui/time-picker";
import { ROUTES } from "@/constants/routes";
import type { Resource, Selection } from "@/features/learning/resources";
import { duration, type PlanEvent } from "@/features/planning/planModel";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  items: Selection[];
  catalogue: Resource[];
  events: PlanEvent[];
  disabled: boolean;
  demo: boolean;
  onUpdatePreference: (resourceId: string, patch: Partial<Selection>) => void;
  onSchedule: (resourceId: string) => void;
  onImport: () => void;
};

export default function SavedCourseQueue(props: Props) {
  const {
    items,
    catalogue,
    events,
    disabled,
    demo,
    onUpdatePreference,
    onSchedule,
    onImport,
  } = props;

  return (
    <aside className="pl-sidebar pl-panel">
      <p className="pl-kicker">YOUR NEXT STEPS</p>
      <h2>Recently saved · {items.length}</h2>
      <p className="pl-muted">Choose a time for your saved courses.</p>
      {items.length ? (
        items.map((selection) => {
          const resource = catalogue.find(
            (item) => item.id === selection.resourceId,
          );
          if (!resource) return null;
          const scheduled = events
            .filter((event) => event.resourceId === resource.id)
            .reduce((minutes, event) => minutes + duration(event), 0);
          const total =
            selection.totalMinutes === undefined
              ? resource.minutes
              : selection.totalMinutes;
          if (total && scheduled >= total) return null;

          const update = (patch: Partial<Selection>) =>
            onUpdatePreference(selection.resourceId, patch);

          return (
            <article className="pl-resource" key={resource.id}>
              {selection.skillName ? <span>{selection.skillName}</span> : null}
              <h3>{resource.title}</h3>
              <p>
                {total ? `${total} min selected` : "Confirm duration with provider"}
              </p>
              {selection.chapterNames?.length ? (
                <details>
                  <summary>{selection.chapterNames.length} selected chapters</summary>
                  <ul>
                    {selection.chapterNames.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {selection.scheduleMode === "routine" && selection.startDate ? (
                <p>Preferred start: {selection.startDate}</p>
              ) : null}
              {selection.weekdays?.length && selection.minutesPerDay ? (
                <p>
                  {selection.weekdays.map((day) => weekDays[day]).join(", ")} ·{" "}
                  {selection.startTime && selection.endTime
                    ? `${selection.startTime}–${selection.endTime}`
                    : `${selection.minutesPerDay} min/day preferred`}
                </p>
              ) : null}
              <div className="pl-work-days">
                {weekDays.map((day, index) => {
                  const selected = selection.weekdays?.includes(index) ?? false;
                  return (
                    <button
                      key={day}
                      aria-pressed={selected}
                      onClick={() =>
                        update({
                          weekdays: selected
                            ? selection.weekdays?.filter((item) => item !== index)
                            : [...(selection.weekdays ?? []), index],
                        })
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="pl-form-row">
                <label>
                  From
                  <TimePicker
                    compact
                    label="Study start time"
                    value={selection.startTime ?? ""}
                    onChange={(value) => update({ startTime: value })}
                  />
                </label>
                <label>
                  To
                  <TimePicker
                    compact
                    label="Study end time"
                    value={selection.endTime ?? ""}
                    onChange={(value) => update({ endTime: value })}
                  />
                </label>
              </div>
              {!total ? (
                <label>
                  Planned minutes
                  <input
                    type="number"
                    min="1"
                    value={selection.totalMinutes ?? ""}
                    onChange={(event) =>
                      update({ totalMinutes: Number(event.target.value) })
                    }
                  />
                </label>
              ) : null}
              {scheduled > 0 ? (
                <p>{scheduled} min scheduled across your plan</p>
              ) : null}
              <button disabled={disabled} onClick={() => onSchedule(resource.id)}>
                Schedule a session <Plus size={14} />
              </button>
            </article>
          );
        })
      ) : (
        <div className="pl-empty">
          <BookOpen />
          <p>No saved courses waiting to be scheduled.</p>
        </div>
      )}
      {items.length ? (
        <button className="pl-primary" disabled={disabled} onClick={onImport}>
          Import course schedule
        </button>
      ) : null}
      <Link
        className="pl-link"
        to={`${ROUTES.learningCentre}${demo ? "" : "?demo=0"}`}
      >
        Explore learning resources <ArrowRight size={14} />
      </Link>
      <div className="pl-tip">
        <Clock3 size={19} />
        <h3>Leave a little breathing room</h3>
        <p>
          Keep time for rest and unexpected changes. An empty space does not
          have to be filled.
        </p>
      </div>
    </aside>
  );
}
