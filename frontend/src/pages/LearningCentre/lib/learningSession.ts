import type { PlanEvent } from "@/pages/Plan/planModel";
import type { Resource, Selection } from "../resources";
import { addDays } from "@/pages/Plan/planModel";
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
  const length = selection?.minutesPerDay ?? 30;
  const endMinutes = 18 * 60 + 30 + length;
  return {
    id: crypto.randomUUID(),
    title: resource?.title ?? "",
    kind: resource ? "learning" : "personal",
    date,
    start: "18:30",
    end: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    flexible: !!resource,
    shareable: false,
    resourceId: resource?.id,
    completed: false,
  };
}
