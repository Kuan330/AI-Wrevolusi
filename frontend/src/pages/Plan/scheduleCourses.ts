import { addDays, dateKey, duration, mins, overlaps, timeString, type PlanEvent } from './planModel';
import type { Resource, Selection } from '@/pages/LearningCentre/resources';
/** Place remaining course minutes into future, conflict-free preferred windows. */
export function scheduleCourses(selections: Selection[], resources: Resource[], existing: PlanEvent[], now = new Date()) {
  const events: PlanEvent[] = [];
  const issues: string[] = [];
  for (const selection of selections) {
    const resource = resources.find(item => item.id === selection.resourceId);
    if (!resource) continue;
    const start = selection.startTime;
    const end = selection.endTime;
    if (!selection.weekdays?.length || !start || !end || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start) {
      issues.push(`${resource.title}: choose study days and a start/end time.`); continue;
    }
    const total = selection.totalMinutes === undefined ? resource.minutes : selection.totalMinutes;
    if (!total || total <= 0) { issues.push(`${resource.title}: duration is unknown; schedule a session manually.`); continue; }
    let remaining = Math.max(0, total - existing.concat(events).filter(item => item.resourceId === resource.id).reduce((sum, item) => sum + duration(item), 0));
    const today = dateKey(now);
    let from = selection.startDate && selection.startDate > today ? selection.startDate : today;
    if (from === today && new Date(`${today}T${start}`).getTime() < now.getTime()) from = addDays(today, 1);
    for (let offset = 0; offset < 366 && remaining > 0; offset++) {
      const date = addDays(from, offset);
      const weekday = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
      if (!selection.weekdays.includes(weekday)) continue;
      const length = Math.min(remaining, mins(end) - mins(start));
      const event: PlanEvent = { id: crypto.randomUUID(), title: resource.title, kind: 'learning', date, start, end: timeString(mins(start) + length), resourceId: resource.id, flexible: true, shareable: false, completed: false };
      if (existing.concat(events).some(other => overlaps(event, other))) continue;
      events.push(event); remaining -= length;
    }
    if (remaining > 0) issues.push(`${resource.title}: ${remaining} min could not fit within the next year. Adjust your study time.`);
  }
  return { events, issues };
}
