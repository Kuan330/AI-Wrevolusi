import { useEffect, useRef } from "react";
import { dateKey, mins, overlaps, type PlanEvent } from './planModel';
export default function WeekCalendar({ days, events, selectedId, onSelect, onAdd }: { days: string[]; events: PlanEvent[]; selectedId: string; onSelect: (id: string) => void; onAdd: (date: string, time: string) => void }) {
  const hourHeight = 42;
  const firstHour = 0;
  const lastHour = 24;
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekStart = days[0];
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * hourHeight;
  }, [weekStart]);
  const selectedStart = events.find(event => event.id === selectedId)?.start;
  useEffect(() => {
    if (selectedStart && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, (mins(selectedStart) - firstHour * 60) * hourHeight / 60 - 50);
    }
  }, [selectedId, selectedStart, firstHour]);
  return <div ref={scrollRef} className="pl-time-scroll"><div className="pl-time-grid">
    <div className="pl-time-head"><span />{days.map(day => <header key={day} className={day === dateKey(new Date()) ? 'is-today' : ''}><span>{new Date(`${day}T12:00:00`).toLocaleDateString('en', { weekday: 'short' })}</span><strong>{Number(day.slice(-2))}</strong></header>)}</div>
    <div className="pl-time-body" style={{ height: hours.length * hourHeight }}><div className="pl-time-labels">{hours.map(hour => <span key={hour} style={{ top: (hour - firstHour) * hourHeight }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
      {days.map(day => <div className="pl-time-day" key={day}>{hours.map(hour => <button className="pl-time-slot" key={hour} aria-label={`Add activity ${day} at ${hour}:00`} style={{ top: (hour - firstHour) * hourHeight }} onClick={() => onAdd(day, `${String(hour).padStart(2, '0')}:00`)} />)}
        {events.filter(event => event.date === day).map(event => {
          const peers = events.filter(other => other.date === day && (other.id === event.id || overlaps(event, other))).sort((a,b) => a.id.localeCompare(b.id));
          const lane = peers.findIndex(other => other.id === event.id);
          return <button key={event.id} className={`pl-timed-event ${event.kind} ${peers.length > 1 ? "conflicted" : ""} ${event.completed ? 'completed' : ''} ${event.id === selectedId ? 'selected' : ''}`} style={{ top: (mins(event.start) - firstHour * 60) * hourHeight / 60, height: Math.max(20, (mins(event.end) - mins(event.start)) * hourHeight / 60 - 2), left: `calc(${lane * 100 / peers.length}% + 3px)`, width: `calc(${100 / peers.length}% - 6px)` }} onClick={() => onSelect(event.id)} title={`${event.title} · ${event.start}–${event.end}`}><strong>{peers.length > 1 ? "⚠ " : ""}{event.title}</strong><span>{event.start}–{event.end}</span></button>;
        })}</div>)}
    </div>
  </div></div>;
}
