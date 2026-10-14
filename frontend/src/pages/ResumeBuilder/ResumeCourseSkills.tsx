import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { modelPreferenceRevision, subscribeModelPreferences } from "@/infrastructure/storage/modelPreferences";
import { currentWorkspaceSession } from "@/services/accountStorage";
import { resumeService } from "@/features/resume/service";
import { resumeErrorMessage } from "@/features/resume/errors";
import { validCourseSkillReviews, type ResumeLearningCourse } from "@/features/resume/courseSkills";
import type { CourseSkillReview } from "@/features/resume/types";
const statusLabel = { completed: "You recorded this course as completed", in_progress: "In progress", planned: "Planned learning", unavailable: "Progress unavailable" };
export default function ResumeCourseSkills({ owner, contextKey, courses, reviews, disabled, change, refresh }: { owner: string; contextKey: string; courses: ResumeLearningCourse[]; reviews: CourseSkillReview[]; disabled: boolean; refresh: () => void; change: (value: CourseSkillReview[]) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const request = useRef<AbortController | null>(null), mounted = useRef(true), session = useRef(currentWorkspaceSession());
  const modelVersion = useSyncExternalStore(subscribeModelPreferences, modelPreferenceRevision, () => 0);
  const key = JSON.stringify([owner, contextKey, modelVersion, disabled, reviews, courses.map(row => [row.course.id, row.course.sourceFingerprint, row.status])]);
  const latest = useRef(key); useLayoutEffect(() => { latest.current = key; }, [key]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, [owner]);
  useEffect(() => { if (request.current) { request.current.abort(); request.current = null; setBusy(false); setStatus("The course inputs changed. Identify skills again using the latest records."); } }, [key]);
  const cancel = () => { request.current?.abort(); request.current = null; setBusy(false); setStatus("Skill identification cancelled. Your confirmed skills are unchanged."); };
  const identify = async (ids: string[]) => {
    if (request.current || disabled || !ids.length) return;
    const active = new AbortController(), captured = key; request.current = active; setBusy(true); setError(""); setStatus("");
    try {
      const result = await resumeService.learningSkills(ids, active.signal);
      if (!mounted.current || active.signal.aborted || request.current !== active || latest.current !== captured || session.current !== currentWorkspaceSession()) return;
      if (!validCourseSkillReviews(result.courses) || result.courses.length !== ids.length || result.courses.some(row => !ids.includes(row.course_id) || row.skills.some(skill => !row.outcomes.includes(skill.quote)))) throw new Error("The server returned invalid learning skill references. Retry identification.");
      request.current = null; setBusy(false);
      change([...reviews.filter(row => !ids.includes(row.course_id)), ...result.courses.map(row => ({ ...row, reviewed: false, skills: row.skills.map(skill => ({ ...skill, selected: false })) }))]);
      setStatus("Select the skills you want to include, then confirm their learning sources.");
    } catch (cause) { if (!active.signal.aborted && mounted.current && request.current === active) setError(resumeErrorMessage(cause)); }
    finally { if (mounted.current && request.current === active) { request.current = null; setBusy(false); } }
  };
  return <section className="rb-course-skills" aria-label="Course learning skills">
    <h4>Skills from your courses</h4><p>Identify specific learning skills from teaching objectives. Choose and confirm them before generating. These are learning choices, not proof of proficiency or course completion.</p>
    <Button variant="outline" disabled={disabled || busy || !courses.length} onClick={() => void identify(courses.map(row => row.course.id))}>Identify learning skills</Button>
    <Button variant="link" disabled={disabled || busy} onClick={refresh}>Refresh course records</Button>
    {busy && <div role="status">Identifying learning skills… <Button variant="ghost" onClick={cancel}>Cancel skill identification</Button></div>}
    {error && <p role="alert" className="rb-warning">{error}</p>}{status && <p role="status">{status}</p>}
    {!courses.length && <p>Choose a course or synchronise learning progress to review its skills.</p>}
    {reviews.filter(review => !courses.some(row => row.course.id === review.course_id)).map(review => <p className="rb-warning" key={review.course_id}>A reviewed course is no longer in the available learning records. Its choices were kept. <Button variant="link" disabled={disabled || busy} onClick={() => change(reviews.filter(row => row.course_id !== review.course_id))}>Remove unavailable choices</Button></p>)}
    {courses.map(({ course, status }) => {
      const review = reviews.find(row => row.course_id === course.id), current = review?.source_fingerprint === course.sourceFingerprint && Boolean(course.sourceFingerprint);
      return <div className="rb-learning-record" key={course.id}><strong>{course.title}</strong><small> · {course.id} · {statusLabel[status]}</small>
        <Button size="sm" variant="link" disabled={disabled || busy} aria-label={"Identify skills for " + course.title + " · " + course.id} onClick={() => void identify([course.id])}>{review ? "Identify again" : "Identify skills"}</Button>
        {review && <>{!current && <p className="rb-warning">The teaching objectives changed. Identify these skills again; previous choices have been kept.</p>}
          {review.notices.length > 0 && <p className="rb-warning">{review.notices.includes("no_teaching_objectives") ? "This course has no teaching objectives available for extraction. Its standard skill mapping is kept." : review.notices.includes("invalid_suggestions") ? "Some suggestions could not be verified. Only valid suggestions are shown; identify again to retry." : "No specific skill suggestions were identified."}</p>}
          {review.skills.map((skill, index) => <div key={skill.name + index}><label className="rb-check"><Checkbox disabled={disabled || busy || !current} checked={Boolean(skill.selected)} onCheckedChange={checked => change(reviews.map(row => row.course_id === course.id ? { ...row, reviewed: false, skills: row.skills.map((old, i) => i === index ? { ...old, selected: checked === true } : old) } : row))} />{skill.name}</label><blockquote>{skill.quote}</blockquote></div>)}
          {review.skills.length > 0 && <label className="rb-check"><Checkbox disabled={disabled || busy || !current || !review.skills.some(skill => skill.selected)} checked={Boolean(review.reviewed && current)} onCheckedChange={checked => change(reviews.map(row => row.course_id === course.id ? { ...row, reviewed: checked === true } : row))} />I reviewed these learning skill choices and their teaching-objective references.</label>}
          <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => change(reviews.filter(row => row.course_id !== course.id))}>Remove skill choices</Button>
        </>}
      </div>;
    })}
  </section>;
}
