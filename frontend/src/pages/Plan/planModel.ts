export type Assistance = {
    name: string;
    message: string;
    status: 'draft' | 'pending' | 'accepted' | 'declined';
    updatedAt: string;
};
export type PlanEvent = {
    id: string;
    title: string;
    kind: 'learning' | 'work' | 'care' | 'personal';
    date: string;
    start: string;
    end: string;
    flexible: boolean;
    shareable: boolean;
    resourceId?: string;
    completed: boolean;
    assistance?: Assistance;
};
export type PlanState = {
    version: 1;
    revision: number;
    events: PlanEvent[];
};
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const addDays = (date: string, days: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return dateKey(d); };
export function monday(date: string) { const d = new Date(`${date}T12:00:00`); return addDays(date, -((d.getDay() + 6) % 7)); }
export const mins = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const timeString = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export const duration = (event: PlanEvent) => mins(event.end) - mins(event.start);
export const isMine = (event: PlanEvent) => event.assistance?.status !== 'accepted';
export const overlaps = (a: PlanEvent, b: PlanEvent) => a.id !== b.id && a.date === b.date && mins(a.start) < mins(b.end) && mins(b.start) < mins(a.end) && isMine(a) && isMine(b);
export function conflicts(events: PlanEvent[]) { return events.flatMap((a, i) => events.slice(i + 1).filter(b => overlaps(a, b)).map(b => [a, b] as const)); }
export function validateEvent(e: PlanEvent) {
    if (!e.title.trim() || e.title.length > 160)
        return 'Enter a title of 1–160 characters.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(new Date(`${e.date}T12:00:00`).valueOf()) || dateKey(new Date(`${e.date}T12:00:00`)) !== e.date)
        return 'Choose a valid date.';
    if (![e.start, e.end].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || mins(e.end) <= mins(e.start))
        return 'End time must be later than start time on the same day.';
    return '';
}
export function suggestions(event: PlanEvent, events: PlanEvent[]) {
    const result: {
        date: string;
        start: string;
        end: string;
    }[] = [];
    for (let day = 0; day < 7 && result.length < 3; day++)
        for (let start = 8 * 60; start + duration(event) <= 21 * 60 && result.length < 3; start += 30) {
            const next = { ...event, date: addDays(event.date, day), start: timeString(start), end: timeString(start + duration(event)), assistance: undefined };
            if (new Date(`${next.date}T${next.start}`) <= new Date())
                continue;
            if (next.date === event.date && next.start === event.start)
                continue;
            if (!events.some(other => overlaps(next, other))) {
                result.push(next);
                break;
            }
        }
    return result;
}
export function requestMessage(event: PlanEvent, name: string) {
    return `Hi ${name.trim()}, could you help with “${event.title}” on ${event.date}, ${event.start}–${event.end} (${Intl.DateTimeFormat().resolvedOptions().timeZone})? Please reply to confirm whether you can take this on. Thank you!`;
}
export const whatsappLink = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;
export function demoPlan(): PlanState {
    const week = monday(dateKey(new Date()));
    const make = (id: string, title: string, kind: PlanEvent['kind'], day: number, start: string, end: string): PlanEvent => ({ id, title, kind, date: addDays(week, day), start, end, flexible: kind === 'learning', shareable: kind === 'care', completed: false });
    return { version: 1, revision: 0, events: [
            ...[0, 1, 2, 3, 4].map(d => make(`work-${d}`, 'Work', 'work', d, '09:00', '17:00')),
            { ...make('learn-1', 'Check AI answers', 'learning', 1, '18:30', '19:00'), resourceId: 'demo-fact-check' },
            { ...make('learn-2', 'Practise a useful work prompt', 'learning', 3, '18:30', '19:00'), resourceId: 'demo-prompts' },
            make('care-1', 'Care for the children', 'care', 3, '18:00', '19:30'),
            make('rest-1', 'Time for myself', 'personal', 5, '10:00', '11:00'),
        ] };
}
