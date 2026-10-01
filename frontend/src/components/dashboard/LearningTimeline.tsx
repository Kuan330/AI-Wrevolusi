import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { planCourseUrl } from "@/features/journey/journey";
import type { LearningActivity } from "@/features/dashboard/learningSummary";
import type { PlanCourse } from "@/features/learning-planning/planCourses";
export default function LearningTimeline({ activities, courses }: { activities: LearningActivity[]; courses: PlanCourse[] }) {
  if (!activities.length) return <p className="dashboard-empty-inline">Your recent learning will appear here when you record course progress, check in or add practice to a goal.</p>;
  return <ol className="history-timeline">{activities.map(activity => <li key={activity.id}><span className={`history-timeline-dot kind-${activity.kind}`} aria-hidden="true" /><div><time dateTime={activity.date}>{new Date(`${activity.date}T12:00:00`).toLocaleDateString("en-MY",{dateStyle:"medium"})}</time><h3>{activity.label}</h3><p>{activity.detail}</p>{activity.goalId ? <Link to={`${ROUTES.learningGoals}?${new URLSearchParams({goal:activity.goalId})}`}>View learning goal →</Link> : activity.courseId && courses.some(course=>course.id===activity.courseId) ? <Link to={planCourseUrl(activity.courseId)}>View course →</Link> : null}</div><span className="dashboard-soft-badge">{activity.kind === "checkin" ? "Check-in" : activity.kind}</span></li>)}</ol>;
}
