import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { referenceService } from "@/services/referenceService";
import { recommendSkills } from "@/features/skills/recommendations";
import { loadLearningCatalogue } from "@/features/learning-planning/courseDirectory";
import { skillKey } from "@/pages/Skills/learningSkills";
import { ROUTES } from "@/constants/routes";
import type { ProfileTask } from "@/features/work-profile/types";
import type { WefSkill } from "@/types/reference";
import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";
import type { Course } from "@/features/learning-planning/types";

type Props = { tasks: ProfileTask[]; assessments: ConfirmedTaskExposureAssessment[]; decisions?: Record<string, string>; compact?: boolean };
export default function SkillRecommendations({ tasks, assessments, decisions, compact }: Props) {
  const [skills,setSkills] = useState<WefSkill[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    referenceService.wefSkills().then(value => { if (alive) setSkills(value); }).catch(() => { if (alive) setError("Skill suggestions could not be loaded."); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt]);
  if (loading) return <p role="status" className="dashboard-muted">Finding skills connected to your work…</p>;
  if (error) return <p role="alert">{error} <Button variant="link" onClick={() => setAttempt(v => v+1)}>Retry</Button></p>;
  const recommendations = recommendSkills(tasks, skills, assessments, decisions);
  if (!recommendations.length) return <div className="dashboard-empty-inline"><Sprout /><p>No supported skill suggestions yet. Review your task wording or add a skill you want to develop.</p><Button asChild variant="outline"><Link to={`${ROUTES.skills}?view=task`}>Review my skills</Link></Button></div>;
  return <div className="dashboard-skill-grid">{recommendations.slice(0,compact ? 3 : 5).map((item,index) => <SkillCard key={item.skill.wef_skill_id} item={item} index={index} compact={compact} />)}</div>;
}
function SkillCard({ item, index, compact }: { item: ReturnType<typeof recommendSkills>[number]; index: number; compact?: boolean }) {
  const [open,setOpen] = useState(false);
  const [courses,setCourses] = useState<Course[] | null>(null);
  const [error,setError] = useState("");
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCourses(null); setError("");
    void loadLearningCatalogue(skillKey(item.skill.core_skill), attempt > 0).then(value => { if (alive) setCourses(value.courses); }).catch(() => { if (alive) setError("Courses are temporarily unavailable. Please try again."); });
    return () => { alive = false; };
  }, [open,item.skill.core_skill,attempt]);
  const link = `${ROUTES.skills}?${new URLSearchParams({ view: "task", task: item.tasks[0].id })}`;
  return <Card className="dashboard-skill-card"><span className={`dashboard-skill-icon tone-${index % 3}`}><Sprout size={20} /></span><h3>{item.skill.core_skill}</h3>
    <p>{item.highTaskCount ? `Connected to ${item.highTaskCount} highly AI-assisted ${item.highTaskCount === 1 ? "task" : "tasks"}.` : `Connected to ${item.tasks.length} of your work ${item.tasks.length === 1 ? "tasks" : "tasks"}.`} Confirm whether this skill fits your work.</p>
    <p className="dashboard-skill-evidence">“{item.tasks[0].wording}”</p>
    <Link className="dashboard-text-link" to={link} state={{ taskWording: item.tasks[0].wording }}>Review skill match <ArrowUpRight size={15} /></Link>
    {!compact && <><Button variant="outline" className="mt-3 w-full" aria-expanded={open} aria-controls={`skill-courses-${item.skill.wef_skill_id}`} onClick={() => setOpen(value => !value)}>{open ? "Hide" : "View"} recommended courses <ChevronDown size={15} /></Button>
      {open && <div id={`skill-courses-${item.skill.wef_skill_id}`} className="skill-course-options">{error ? <p role="alert">{error}<Button variant="link" onClick={() => setAttempt(value=>value+1)}>Retry</Button></p> : !courses ? <p role="status">Loading courses…</p> : !courses.length ? <p>No verified courses linked to this skill yet. You can still create a learning goal from its task review.</p> : courses.slice(0,4).map(course => <div key={course.id}><strong>{course.title}</strong><small>{course.provider} · {course.level}{course.durationMin ? ` · ${course.durationMin} min` : ""}</small><Link to={`${ROUTES.learningCentre}?${new URLSearchParams({ mode: "browse", course: course.id })}`}>Choose course →</Link></div>)}</div>}
    </>}
  </Card>;
}
