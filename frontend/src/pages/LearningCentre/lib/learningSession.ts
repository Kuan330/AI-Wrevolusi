import type { PlanEvent } from "@/pages/Plan/planModel";
import type { Resource, Selection } from "../resources";
import { addDays, mins, timeString } from "@/pages/Plan/planModel";
/** Produces an editable session, never a saved calendar event. */
export function learningSession(
  resource: Resource | undefined,
  selection: Selection | undefined,
  fallbackDate: string,
): PlanEvent {
  let date =
    selection?.scheduleMode === "routine" &&
    selection.startDate &&
    selection.startDate >= fallbackDate
      ? selection.startDate
      : fallbackDate;
  if (selection?.scheduleMode === "routine" && selection.weekdays?.length) {
    for (let offset = 0; offset < 7; offset++) {
      const candidate = addDays(date, offset);
      const day = (new Date(`${candidate}T12:00:00`).getDay() + 6) % 7;
      if (selection.weekdays.includes(day)) {
        date = candidate;
        break;
      }
    }
  }
  const start = selection?.startTime || "18:30";
  const length = selection?.minutesPerDay ?? 30;
  const endMinutes = mins(start) + length;
  return {
    id: crypto.randomUUID(),
    title: resource?.title ?? "",
    kind: resource ? "learning" : "personal",
    date,
    start,
    end: selection?.endTime || timeString(Math.min(endMinutes, 1439)),
    flexible: !!resource,
    shareable: false,
    resourceId: resource?.id,
    completed: false,
  };
}
