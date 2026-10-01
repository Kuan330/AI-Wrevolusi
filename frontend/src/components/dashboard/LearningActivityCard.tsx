import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { learningSummary } from "@/features/dashboard/learningSummary";
import ActivityCalendar from "./ActivityCalendar";

type Props = {
  summary: ReturnType<typeof learningSummary>;
};
export default function LearningActivityCard({ summary }: Props) {
  return <Card className="dashboard-panel">
    <div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">YOUR LEARNING ACTIVITY</p><h2>A little progress, every day.</h2></div><Link className="dashboard-text-link" to={ROUTES.progress}>Learning records <ArrowRight size={16} /></Link></div>
    <p>{summary.activities.length} learning records · {summary.completedChapters} completed chapters · {summary.completedCourses} completed courses</p>
    <ActivityCalendar activities={summary.activities} weeks={52} />
    <p className="dashboard-footnote">Hover over a day to see its learning activity. Study, check-ins and practice all count as activity.</p>
  </Card>;
}
