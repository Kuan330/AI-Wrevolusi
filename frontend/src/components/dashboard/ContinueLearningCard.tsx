import { Link } from "react-router-dom";
import { ArrowRight, History, Sprout, Route, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ROUTES } from "@/constants/routes";
import { learningSummary, coursePercent } from "@/features/dashboard/learningSummary";
import type { LearningGoal } from "@/features/learning-goals/learningGoals";
import type { LearningContext } from "@/features/journey/journey";
import SkillProgressCard from "./SkillProgressCard";

type Props = { summary: ReturnType<typeof learningSummary> | null; latestGoal?: LearningGoal; learningPath: string; courseContext?: LearningContext };
export default function ContinueLearningCard({ summary, latestGoal, learningPath, courseContext }: Props) {
  const course = summary?.nextCourse;
  const hasLearning = Boolean(course || latestGoal);
  const skillName = course ? courseContext?.skill.name : latestGoal?.initial.skill.label;
  const completed = course?.chapters.filter(chapter => chapter.value === 10).length;
  return <Card className="growth-plan-card">
    <header className="growth-plan-header"><span><Sprout size={19} /> MY GROWTH PLAN</span><span>A little learning. A new possibility.</span></header>
    <div className="growth-plan-intro"><h2>{hasLearning ? "Make space for your next chapter." : "Turn a skill into your next learning goal."}</h2><p>{hasLearning ? "Keep building on what you know, one useful step at a time." : "Choose a skill, explore a course and build a plan that fits your day."}</p></div>
    <div className="growth-plan-grid">
      <section className="growth-course-card" aria-label="Continue your learning">
        <p className="dashboard-eyebrow">{hasLearning ? "PICK UP WHERE YOU LEFT OFF" : "YOUR FIRST STEP"}</p>
        <h3>{course?.title || latestGoal?.wording || "Choose what you want to grow."}</h3>
        <p>{summary?.nextChapter ? `Next: ${summary.nextChapter.title}` : !course && latestGoal?.action?.text || "Start with a skill that matters to your work. Your learning plan will take shape here."}</p>
        {course && <><div className="growth-course-meta"><span>{course.provider}</span><span>{completed} of {course.chapters.length} chapters complete</span></div><div className="dashboard-learning-progress"><Progress value={coursePercent(course)} aria-label="Current course progress" /><span>{coursePercent(course)}%</span></div></>}
        {hasLearning && <div className="dashboard-learning-actions"><Button asChild><Link to={learningPath}>Continue learning <ArrowRight size={16} /></Link></Button></div>}
        {!hasLearning && <div className="growth-start-note"><span>01</span><div><strong>Your experience is the starting point.</strong><p>Review your work, choose a skill and set a learning goal.</p></div></div>}
      </section>
      <SkillProgressCard name={skillName} completedChapters={completed} totalChapters={course?.chapters.length} practiceCount={!course ? latestGoal?.attempts.length : undefined} />
    </div>
    <nav className="growth-plan-actions" aria-label="Learning shortcuts">
      <Button asChild variant={hasLearning ? "ghost" : "default"}><Link to={ROUTES.skills}><Route size={18} />Explore my skill path <ArrowRight size={16} /></Link></Button>
      <Link className="dashboard-text-link" to={ROUTES.learningGoals}><ListChecks size={18} />View my plan <ArrowRight size={15} /></Link>
      <Link className="dashboard-text-link" to={ROUTES.progress}><History size={18} />View learning records <ArrowRight size={15} /></Link>
    </nav>
  </Card>;
}
