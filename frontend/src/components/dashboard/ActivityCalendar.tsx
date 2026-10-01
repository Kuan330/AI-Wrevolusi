import { activityDays, type LearningActivity } from "@/features/dashboard/learningSummary";
export default function ActivityCalendar({ activities, selectedDate, onSelect }: { activities: LearningActivity[]; selectedDate?: string; onSelect?: (date: string) => void }) {
  const days = activityDays(activities);
  return <div className="activity-calendar"><div className="activity-calendar-heading"><span>{days[0].date}</span><span>Last 12 weeks</span><span>{days.at(-1)?.date}</span></div>
    <div className="activity-calendar-grid">{days.map(day => <button key={day.date} type="button" title={`${day.date}: ${day.count} records`} aria-label={`${day.date}: ${day.count} learning records`} aria-pressed={selectedDate === day.date} className={`activity-day activity-level-${Math.min(day.count, 3)}`} onClick={() => onSelect?.(day.date)} disabled={!onSelect} />)}</div>
    <p className="activity-calendar-legend">Less <span className="activity-level-0" /><span className="activity-level-1" /><span className="activity-level-2" /><span className="activity-level-3" /> More</p>
  </div>;
}
