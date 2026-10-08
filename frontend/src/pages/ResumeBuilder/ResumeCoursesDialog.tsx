import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";
import type { Course } from "@/features/learning-planning/types";
import type { RecommendedCourse } from "@/features/resume/types";
type Props = { open: boolean; onOpenChange: (open: boolean) => void; courses: { course: Course; recommendation: RecommendedCourse }[]; saved: string[]; selected: string[]; select: (ids: string[]) => void; saving: boolean; add: () => void; notice: string };
export default function ResumeCoursesDialog(props: Props) {
  const available = props.courses.filter(({ course }) => !props.saved.includes(course.id)).map(({ course }) => course.id);
  const selected = props.selected.filter(id => available.includes(id));
  const all = available.length > 0 && selected.length === available.length;
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="rw-courses-dialog"><DialogHeader><div className="rw-courses-title"><span className="rw-courses-icon"><BookOpen size={21} /></span><div><DialogTitle>Courses for your next role</DialogTitle><DialogDescription>Choose your next step. Add courses to My courses.</DialogDescription></div></div></DialogHeader>
    <div className="rw-courses-selection"><span>{selected.length} selected<small> · {props.courses.length} recommended</small></span><label className="rb-check"><Checkbox aria-label="Select all available courses" checked={all ? true : selected.length ? "indeterminate" : false} disabled={!available.length || props.saving} onCheckedChange={checked => props.select(checked === true ? available : [])} />Select all</label></div>
    <div className="rw-courses-list">{props.courses.map(({ course, recommendation }) => { const added = props.saved.includes(course.id), checked = added || selected.includes(course.id); return <label className={`rw-course-item ${added ? "rw-course-added" : checked ? "rw-course-selected" : ""}`} key={course.id}><Checkbox aria-label={added ? `${course.title}, already added` : `Select ${course.title}`} checked={checked} disabled={added || props.saving} onCheckedChange={value => props.select(value === true ? [...new Set([...selected, course.id])] : selected.filter(id => id !== course.id))} /><div className="rw-course-copy"><div className="rw-course-meta"><span>{course.provider}</span>{course.level && <Badge variant="outline">{course.level}</Badge>}{added && <Badge variant="secondary" className="rw-added-badge"><Check size={12} />Added</Badge>}</div><h3>{course.title}</h3><p>{recommendation.reason}</p></div></label>; })}</div>
    <div className="rw-courses-footer">{props.notice && <p role="status">{props.notice}</p>}<div><Button disabled={!selected.length || props.saving} onClick={props.add}>{props.saving ? "Adding…" : "Add selected to My courses"}</Button><Button variant="link" asChild><Link to={ROUTES.plan}>Open My courses<ArrowRight size={15} /></Link></Button></div></div>
  </DialogContent></Dialog>;
}
