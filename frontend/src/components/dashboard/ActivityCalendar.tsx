import type { CSSProperties } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { activityDays, type LearningActivity } from "@/features/dashboard/learningSummary";
import { addDays, dateKey } from "@/features/learning-planning/planModel";

export default function ActivityCalendar({ activities, weeks = 12 }: { activities: LearningActivity[]; weeks?: 12 | 52 }) {
  const today = dateKey(new Date());
  const year = Number(today.slice(0,4));
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  const offset = new Date(`${first}T12:00:00`).getDay();
  const counts = new Map<string, number>();
  activities.forEach(activity => counts.set(activity.date, (counts.get(activity.date) ?? 0) + 1));
  const annualDays = Array.from({length:366}, (_,index) => addDays(first,index)).filter(date => date <= last);
  const days = weeks === 52 ? annualDays.map(date => ({date,count:counts.get(date) ?? 0})) : activityDays(activities);
  const leading = weeks === 52 ? offset : new Date(`${days[0].date}T12:00:00`).getDay();
  const columns = Math.ceil((days.length + leading) / 7);
  const months = days.flatMap((day,index) => {
    if(index && day.date.slice(0,7) === days[index-1].date.slice(0,7)) return [];
    const column = Math.floor((index + leading) / 7) + 1;
    if(column > columns - 2) return [];
    return [{date:day.date,column,label:new Date(`${day.date}T12:00:00`).toLocaleDateString("en-MY",{month:"short"})}];
  });
  const style = {"--calendar-weeks":columns} as CSSProperties;
  return <div className="activity-calendar">
    <div className="activity-calendar-heading"><span>{weeks === 52 ? year : "Last 12 weeks"}</span><span>Learning activity</span></div>
    <div className="activity-calendar-scroll" tabIndex={0} role="region" aria-label="Learning activity calendar">
      <div className="activity-calendar-body" style={style}>
        <div className="activity-calendar-months" aria-hidden="true">{months.map(month => <span key={month.date} style={{gridColumn:`${month.column} / span 3`}}>{month.label}</span>)}</div>
        <div className="activity-weekdays" aria-hidden="true"><span style={{gridRow:2}}>Mon</span><span style={{gridRow:4}}>Wed</span><span style={{gridRow:6}}>Fri</span></div>
        <div className="activity-calendar-grid">
          {Array.from({length:leading},(_,i)=><span key={`blank-${i}`} />)}
          {days.map((day) => {
            const label = `${day.date}: ${day.count} learning ${day.count === 1 ? "record" : "records"}${day.date === today ? ", today" : ""}`;
            return (
              <Tooltip
                key={day.date}
                contentClassName="activity-calendar-tooltip"
                title={
                  <span className="activity-tooltip-content">
                    <strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}{day.date === today ? " · Today" : ""}</strong>
                    <span>{day.count} learning {day.count === 1 ? "record" : "records"}</span>
                  </span>
                }
              >
                <span
                  tabIndex={0}
                  aria-label={label}
                  aria-current={day.date === today ? "date" : undefined}
                  className={`activity-day activity-level-${Math.min(day.count, 3)}`}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
    <p className="activity-calendar-legend">Less <span className="activity-level-0"/><span className="activity-level-1"/><span className="activity-level-2"/><span className="activity-level-3"/> More</p>
  </div>;
}
