import { useState } from "react";
import { Check, Pencil, Undo2 } from "lucide-react";
import { Link } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerBody } from '@/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AppButton } from '@/components/ui/app-button';
import type { Course } from '@/pages/LearningCentre/types';
import type { PlanEvent } from './planModel';
export default function PlanCourseDrawer({ course, events, selectedEvent, busy, onComplete, onClose, onEdit }: { course: Course; events: PlanEvent[]; selectedEvent: PlanEvent; busy: boolean; onComplete: (event: PlanEvent) => Promise<boolean>; onClose: () => void; onEdit: (event: PlanEvent) => void }) {
  const [saveError, setSaveError] = useState('');
  async function toggle(event: PlanEvent) {
    setSaveError('');
    if (!await onComplete(event)) setSaveError('Could not update completion. Please try again.');
  }
  return <Drawer open onOpenChange={open => { if (!open) onClose(); }}><DrawerContent className="plan-course-drawer sm:max-w-2xl"><DrawerHeader><p className="text-sm uppercase tracking-widest text-[#4f91ba]">{course.provider}</p><DrawerTitle>{course.title} <span className="ml-2 inline-block rounded-full bg-[#f4e1e9] px-3 py-1 text-xs text-[#9c5f78]">In learning plan</span></DrawerTitle><DrawerDescription>{course.level} · {course.language}</DrawerDescription></DrawerHeader><div className="rounded-2xl border border-white bg-gradient-to-r from-[#eaf3fb] to-[#f8ecef] px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[#3d5f7a]">Selected session · {selectedEvent.date}</strong><span className="text-[#9c5f78]">{selectedEvent.completed ? 'Completed' : 'Planned'}</span></div><p className="mt-1 text-[#7f7280]">{selectedEvent.start}–{selectedEvent.end} · {events.filter(event => event.completed).length} of {events.length} sessions completed</p></div><DrawerBody><Tabs defaultValue="overview"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="chapters">Chapters</TabsTrigger><TabsTrigger value="schedule">Schedule</TabsTrigger></TabsList><TabsContent value="overview" className="space-y-5 pt-4"><h3 className="font-semibold text-[#3d5f7a]">About this course</h3><p>{course.intro}</p><h3 className="font-semibold text-[#3d5f7a]">What you will learn</h3><ul className="list-disc space-y-2 pl-5">{course.outcomes.map(item => <li key={item}>{item}</li>)}</ul><h3 className="font-semibold text-[#3d5f7a]">Before you start</h3><p>{course.prereq}</p></TabsContent><TabsContent value="chapters" className="space-y-3 pt-4">{course.chapters?.length ? course.chapters.map((chapter, index) => <div key={index} className="rounded-xl bg-white p-4">{index + 1}. {chapter.title}{chapter.min !== null && <span className="ml-2 text-sm text-[#7f7280]">{chapter.min} min</span>}</div>) : <p>The provider has not supplied a chapter list.</p>}</TabsContent><TabsContent value="schedule" className="space-y-3 pt-4">{events.slice().sort((a,b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)).map(event => <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4"><div>{event.date}<p className="text-sm text-[#4f91ba]">{event.start}–{event.end} · {event.completed ? 'Completed' : 'Planned'}</p></div><div className="flex flex-wrap gap-3"><button disabled={busy} className="text-sm text-[#4f91ba]" onClick={() => onEdit(event)}>Edit</button><button disabled={busy} className="text-sm text-[#9c5f78]" onClick={() => toggle(event)}>{event.completed ? "Undo completion" : "Mark complete"}</button></div></div>)}</TabsContent></Tabs></DrawerBody><div className="shrink-0 space-y-3 border-t border-[#e9e1e9] pt-4">
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
      <div className="grid grid-cols-2 gap-3">
        <AppButton tone="gradient" disabled={busy} onClick={() => onEdit(selectedEvent)}><Pencil size={16} /> Edit time</AppButton>
        <AppButton tone="brand" disabled={busy} onClick={() => toggle(selectedEvent)}>{selectedEvent.completed ? <Undo2 size={16} /> : <Check size={16} />}{selectedEvent.completed ? 'Undo completion' : 'Mark complete'}</AppButton>
      </div>
      <Link className="block text-center text-sm text-[#4f91ba] py-1" to={`/learning-centre?q=${encodeURIComponent(course.title)}`}>View in Learning Resources →</Link>
    </div></DrawerContent></Drawer>;
}
