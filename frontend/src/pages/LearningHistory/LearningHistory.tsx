import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, History, X } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import { useLearningSnapshot } from "@/hooks/useWorkspaceSnapshot";
import { useAccount } from "@/components/account/useAccount";
import { learningSummary, coursePercent, courseStatus } from "@/features/dashboard/learningSummary";
import { planCourseUrl } from "@/features/journey/journey";
import { ROUTES } from "@/constants/routes";

export default function LearningHistory() {
  const { data, error } = useLearningSnapshot();
  const { reload } = useAccount();
  const [filter,setFilter] = useState("all");
  const [selectedDate,setSelectedDate] = useState<string>();
  const [limit,setLimit] = useState(20);
  if (error) return <Card className="dashboard-panel" role="alert"><h1>Your learning records need attention</h1><p>{error}</p><Button onClick={reload}>Reload saved work</Button></Card>;
  if (!data) return <p role="status">Loading your learning records…</p>;
  const summary = learningSummary(data.plan,data.goals);
  const courses = data.plan.courses.filter(course => filter === "all" || courseStatus(course) === filter);
  const activities = summary.activities.filter(activity => !selectedDate || activity.date === selectedDate);
  const activeDays = new Set(summary.activities.map(activity => activity.date)).size;
  return <div className="dashboard-page learning-history-page">
    <PageHeader title="Learning history & progress" description="Every step counts. Return to your courses and see the learning you have recorded." actions={<Button asChild variant="outline"><Link to={ROUTES.learningGoals}>My learning plan <ArrowRight size={16} /></Link></Button>} />
    <div className="history-metrics">{[{icon:BookOpen,value:data.plan.courses.length,label:"Saved courses"},{icon:CheckCircle2,value:summary.completedChapters,label:"Completed chapters"},{icon:CalendarDays,value:activeDays,label:"Days with records"},{icon:History,value:summary.activities.length,label:"Learning records"}].map(({icon:Icon,value,label}) => <Card className="history-metric" key={label}><span className="dashboard-icon tone-0"><Icon size={20} /></span><div><strong>{value}</strong><p>{label}</p></div></Card>)}</div>
    <Card className="dashboard-panel"><div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">KEEP SHOWING UP FOR YOURSELF</p><h2>Your learning activity</h2></div><span className="dashboard-soft-badge">{summary.percent}% chapter progress</span></div><p>Select a day to see its records below. Check-ins and practice are included.</p><ActivityCalendar activities={summary.activities} selectedDate={selectedDate} onSelect={date => { setSelectedDate(date === selectedDate ? undefined : date); setLimit(20); }} /></Card>
    <section><div className="dashboard-section-heading"><h2>Your courses</h2><label className="history-filter">Show <select aria-label="Filter courses" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All courses</option><option value="learning">In progress</option><option value="completed">Completed</option><option value="planned">Not started</option></select></label></div>
      {courses.length ? <div className="history-course-grid">{courses.map(course => <Card className="dashboard-panel history-course" key={course.id}><p className="dashboard-eyebrow">{course.provider}</p><h3>{course.title}</h3><p>{course.chapters.filter(ch=>ch.value===10).length} of {course.chapters.length} chapters complete</p><div className="dashboard-learning-progress"><Progress value={coursePercent(course)} aria-label={`${course.title} progress`} /><span>{coursePercent(course)}%</span></div><Link className="dashboard-text-link" to={planCourseUrl(course.id)}>{courseStatus(course) === "completed" ? "Review course" : "Continue learning"}<ArrowRight size={16} /></Link></Card>)}</div> : <Card className="dashboard-panel"><h3>{data.plan.courses.length ? "No courses in this group yet." : "Your learning story starts here."}</h3><p>{data.plan.courses.length ? "Choose another filter to see your saved courses." : "Choose a skill and add a course to your learning plan. Your progress will appear here."}</p><Button asChild variant="outline"><Link to={ROUTES.skills}>Explore skill paths</Link></Button></Card>}
    </section>
    <Card className="dashboard-panel"><div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">SMALL STEPS, REAL RECORDS</p><h2>{selectedDate ? `Activity on ${selectedDate}` : "Learning timeline"}</h2></div>{selectedDate && <Button variant="ghost" onClick={()=>{setSelectedDate(undefined);setLimit(20);}}>All dates <X size={15} /></Button>}</div>
      {activities.length ? <ol className="history-timeline">{activities.slice(0,limit).map(activity => <li key={activity.id}><span className={`history-timeline-dot kind-${activity.kind}`} aria-hidden="true" /><div><time dateTime={activity.date}>{new Date(`${activity.date}T12:00:00`).toLocaleDateString("en-MY",{dateStyle:"medium"})}</time><h3>{activity.label}</h3><p>{activity.detail}</p>{activity.goalId ? <Link to={`${ROUTES.learningGoals}?${new URLSearchParams({goal:activity.goalId})}`}>View learning goal →</Link> : activity.courseId && data.plan.courses.some(course=>course.id===activity.courseId) ? <Link to={planCourseUrl(activity.courseId)}>View course →</Link> : null}</div><span className="dashboard-soft-badge">{activity.kind === "checkin" ? "Check-in" : activity.kind}</span></li>)}</ol> : <p className="dashboard-empty-inline">{selectedDate ? "No learning activities recorded on this day. Choose another date or view all records." : "As you record course progress, check in or add practice to a goal, your learning history appears here."}</p>}
      {activities.length > limit && <Button variant="outline" onClick={()=>setLimit(value=>value+20)}>Show more records</Button>}
    </Card>
    <Card className="dashboard-career-card"><span className="dashboard-icon tone-1"><History size={23} /></span><div><h3>See how your records change over time</h3><p>Compare saved progress reviews and revisit your supporting evidence.</p></div><Button asChild variant="outline"><Link to={ROUTES.progressReviews}>View progress reviews</Link></Button></Card>
    <p className="dashboard-footnote">Progress reflects recorded study and practice, not an assessment of skill mastery. Previous records remain available when you change your work or learning goals.</p>
  </div>;
}
