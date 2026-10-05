import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/common/PageHeader";
import ContinueLearningCard from "@/components/dashboard/ContinueLearningCard";
import CareerPathCard from "@/components/dashboard/CareerPathCard";
import LearningActivityCard from "@/components/dashboard/LearningActivityCard";
import LearningTimeline from "@/components/dashboard/LearningTimeline";
import { useAccount } from "@/components/account/useAccount";
import { useLearningOverviewSnapshot } from "@/hooks/useWorkspaceSnapshot";
import { useCareerPath } from "@/hooks/useCareerPath";
import { ROUTES } from "@/constants/routes";
import { learningSummary } from "@/features/dashboard/learningSummary";
import { planCourseUrl } from "@/features/journey/journey";

export default function Dashboard() {
  const { user, reload } = useAccount();
  const { data, error } = useLearningOverviewSnapshot();
  const careerPath = useCareerPath();
  if (error) return <Card className="dashboard-panel" role="alert"><h1 className="text-xl font-semibold">Your workspace needs attention</h1><p>{error}</p><div className="mt-4 flex flex-wrap gap-3"><Button onClick={reload}>Reload saved work</Button><Button asChild variant="outline"><Link to={ROUTES.progress}>View learning records</Link></Button></div></Card>;
  if (!data) return <p role="status">Loading your overview…</p>;
  const summary = learningSummary(data.plan, data.goals, data.journey.resume?.kind === "course" ? data.journey.resume.id : undefined);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const latestGoal = data?.goals.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  const learningPath = summary?.nextCourse ? planCourseUrl(summary.nextCourse.id) : latestGoal ? `${ROUTES.learningGoals}?${new URLSearchParams({goal:latestGoal.id})}` : ROUTES.skills;
  const continueCard = <ContinueLearningCard compact={Boolean(careerPath)} summary={summary} latestGoal={latestGoal} learningPath={learningPath} courseContext={summary?.nextCourse ? data.journey.contexts[data.journey.courseContexts[summary.nextCourse.id]] : undefined} />;
  return <div className="dashboard-page">
    <PageHeader title={`${greeting}${user ? `, ${user.username}` : ""}`} description="Your learning plan, your progress, your next step." actions={<Button asChild variant="outline"><Link to={ROUTES.skills}><Plus size={16} /> New learning goal</Link></Button>} />
    {careerPath ? <div className="career-overview"><CareerPathCard path={careerPath} />{continueCard}</div> : continueCard}
    {summary && <LearningActivityCard summary={summary} />}


    {summary && data && <div className="dashboard-overview-grid">
      <Card className="dashboard-panel dashboard-progress-summary"><p className="dashboard-eyebrow">YOUR LEARNING PROGRESS</p><h2>Small steps add up.</h2><div className="dashboard-work-metrics"><div><strong>{summary.completedChapters}</strong><span>completed chapters</span></div><div><strong>{summary.completedCourses}</strong><span>completed courses</span></div></div><p>See the chapters and courses you have completed, and continue at your own pace.</p><Link className="dashboard-text-link" to={ROUTES.plan}>View my courses <ArrowRight size={16} /></Link></Card>
      <Card className="dashboard-panel"><div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">KEEP YOUR MOMENTUM</p><h2>Recent learning activity</h2></div><Link className="dashboard-text-link" to={ROUTES.progress}>View all <ArrowRight size={16} /></Link></div><LearningTimeline activities={summary.activities.slice(0,3)} courses={data.plan.courses} /></Card>
    </div>}

  </div>;
}
