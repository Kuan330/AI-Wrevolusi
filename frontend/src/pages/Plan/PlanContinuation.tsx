import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { getCourseContext, learningContextNeedsReview, learningContextUrl, readJourneyState, rememberCourse } from "@/features/journey/journey";
import { loadCourseDirectory } from "@/features/learning-planning/courseDirectory";
import type { PlanCourse } from "@/features/learning-planning/planCourses";
import type { Course } from "@/features/learning-planning/types";

export default function PlanContinuation({ courses, loading, onRecord }: {
  courses: PlanCourse[]; loading: boolean; onRecord: (course: PlanCourse) => void;
}) {
  const [params] = useSearchParams();
  const requestedId = params.get("course");
  const [directory, setDirectory] = useState<Map<string, Course>>(new Map());
  const [catalogueError, setCatalogueError] = useState("");
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    let active = true;
    void loadCourseDirectory().then(value => { if (active) setDirectory(value); }).catch(() => {
      if (active) setCatalogueError("Course-provider details are temporarily unavailable. Your saved progress is still available.");
    });
    return () => { active = false; };
  }, []);
  let contextError = "";
  let journey: ReturnType<typeof readJourneyState> | null = null;
  let context: ReturnType<typeof getCourseContext> = null;
  let stale = false;
  try { journey = readJourneyState(); }
  catch (error) { contextError = error instanceof Error ? error.message : "Could not read your learning choices."; }
  const activeCourses = courses.filter(course => !course.chapters.length || course.chapters.some(chapter => chapter.value < 10));
  const resumeId = journey?.resume?.kind === "course" ? journey.resume.id : null;
  const selected = requestedId
    ? courses.find(course => course.id === requestedId)
    : activeCourses.find(course => course.id === resumeId) ?? (activeCourses.length === 1 ? activeCourses[0] : undefined);
  try {
    context = selected ? getCourseContext(selected.id) : journey?.activeContextId ? journey.contexts[journey.activeContextId] : null;
    stale = Boolean(context && learningContextNeedsReview(context));
  } catch (error) { contextError = error instanceof Error ? error.message : "Could not read the saved learning connection."; }
  const provider = selected ? directory.get(selected.id) : null;
  const nextChapter = selected?.chapters.find(chapter => chapter.value < 10);
  if (loading) return <p role="status" className="mb-4 rounded-2xl border bg-white/80 p-5">Restoring your learning…</p>;
  return <section className="mb-5 rounded-2xl border border-white bg-white/90 p-5 shadow-sm" aria-labelledby="learning-next-step">
    <h2 id="learning-next-step" className="text-xl font-semibold">
      {requestedId && !selected ? "This course is no longer in your learning list" : selected ? selected.title : context ? "Your saved learning goal" : "Your next learning step"}
    </h2>
    {contextError && <p role="alert" className="my-3 text-sm">{contextError} <Link className="underline" to={ROUTES.continue}>Review recovery options</Link></p>}
    {requestedId && !selected ? <p className="mt-2 text-sm">Your other courses and progress are still available below. Choose a saved course or return to finding learning.</p> : <>
      {context && <div className="mt-3 space-y-1 text-sm">
        <p><strong>Selected skill:</strong> {context.skill.name}</p>
        {context.goal && <p><strong>Your goal:</strong> {context.goal}</p>}
        {context.career ? <p><strong>Career direction:</strong> {context.career.title}</p> : context.taskLabels.length > 0 ? <p><strong>Based on your work:</strong> {context.taskLabels.join("; ")}</p> : <p>Learning you chose to explore.</p>}
        {stale && <p role="status" className="text-amber-900">This connection was saved before your work or skill review changed. Your course and progress remain available. <Link className="underline" to={ROUTES.skills}>Review my skills</Link></p>}
      </div>}
      {selected && <p className="mt-3 text-sm">{selected.provider} · {selected.chapters.filter(chapter => chapter.value === 10).length} of {selected.chapters.length} recorded steps completed{nextChapter ? ` · Next: ${nextChapter.title}` : ""}</p>}
      {!selected && !context && <p className="mt-2 text-sm">{activeCourses.length > 1 ? "Choose a saved course below to continue where you want to work next." : courses.length ? "Your recorded courses are complete. You can review your skills or choose another learning goal." : "Choose one skill and save a course or a learning goal. Your work stays connected to that choice."}</p>}
    </>}
    <div className="mt-4 flex flex-wrap gap-3">
      {selected && provider?.url && <Button asChild><a href={provider.url} target="_blank" rel="noopener noreferrer" onClick={() => {
        void rememberCourse(selected.id).catch(error => setActionError(error instanceof Error ? error.message : "Could not save your continuation choice."));
      }}>Continue course <span className="sr-only">on the provider website, opens a new tab</span></a></Button>}
      {selected && <Button variant={provider?.url ? "outline" : "default"} onClick={() => onRecord(selected)}>Record progress for this course</Button>}
      {selected && context && <Button asChild variant="outline"><Link to={learningContextUrl(context)}>Back to this learning goal</Link></Button>}
      {!selected && <Button asChild variant="outline"><Link to={context ? learningContextUrl(context) : ROUTES.skills}>{context ? "Find learning for this skill" : "Review my skills"}</Link></Button>}
      <Button asChild variant="ghost"><Link to={`${ROUTES.learningCentre}?mode=browse`}>Find other learning</Link></Button>
    </div>
    {catalogueError && <p role="status" className="mt-3 text-sm">{catalogueError}</p>}
    {actionError && <p role="alert" className="mt-3 text-sm">{actionError}</p>}
  </section>;
}
