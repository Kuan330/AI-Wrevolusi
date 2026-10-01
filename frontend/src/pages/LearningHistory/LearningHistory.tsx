import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, History, X } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form-field";
import LearningTimeline from "@/components/dashboard/LearningTimeline";
import { useLearningSnapshot } from "@/hooks/useWorkspaceSnapshot";
import { useAccount } from "@/components/account/useAccount";
import { learningActivities } from "@/features/dashboard/learningSummary";
import { ROUTES } from "@/constants/routes";

export default function LearningHistory() {
  const { data, error } = useLearningSnapshot();
  const { reload } = useAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;
  const setSelectedDate = (date?: string) => setSearchParams(current => { const next = new URLSearchParams(current); if (date) next.set("date", date); else next.delete("date"); return next; });
  const [limit,setLimit] = useState(20);
  if (error) return <Card className="dashboard-panel" role="alert"><h1>Your learning records need attention</h1><p>{error}</p><Button onClick={reload}>Reload saved work</Button></Card>;
  if (!data) return <p role="status">Loading your learning records…</p>;
  const activities = learningActivities(data.plan,data.goals).filter(activity => !selectedDate || activity.date === selectedDate);
  return <div className="dashboard-page learning-history-page">
    <PageHeader title="Learning records" description="Browse your study, course progress and practice records. Filter by date to revisit a specific day." actions={<Button asChild variant="outline"><Link to={ROUTES.learningGoals}>My learning plan <ArrowRight size={16} /></Link></Button>} />
    <div className="records-filter-bar">
      <label htmlFor="learning-record-date">Filter by date</label>
      <Input id="learning-record-date" type="date" value={selectedDate ?? ""} onChange={event=>{setSelectedDate(event.target.value || undefined);setLimit(20);}} className="w-auto" />
      <span>{activities.length} {activities.length === 1 ? "record" : "records"}</span>
    </div>
    <Card className="dashboard-panel"><div className="dashboard-section-heading"><div><p className="dashboard-eyebrow">SMALL STEPS, REAL RECORDS</p><h2>{selectedDate ? `Activity on ${selectedDate}` : "Learning timeline"}</h2></div>{selectedDate && <Button variant="ghost" onClick={()=>{setSelectedDate(undefined);setLimit(20);}}>All dates <X size={15} /></Button>}</div>
      {activities.length ? <LearningTimeline activities={activities.slice(0,limit)} courses={data.plan.courses} /> : <p className="dashboard-empty-inline">{selectedDate ? "No learning activities recorded on this day. Choose another date or view all records." : "As you record course progress, check in or add practice to a goal, your learning history appears here."}</p>}
      {activities.length > limit && <Button variant="outline" onClick={()=>setLimit(value=>value+20)}>Show more records</Button>}
    </Card>
    <Card className="dashboard-career-card"><span className="dashboard-icon tone-1"><History size={23} /></span><div><h3>See how your records change over time</h3><p>Compare saved progress reviews and revisit your supporting evidence.</p></div><Button asChild variant="outline"><Link to={ROUTES.progressReviews}>View progress reviews</Link></Button></Card>
    <p className="dashboard-footnote">Progress reflects recorded study and practice, not an assessment of skill mastery. Previous records remain available when you change your work or learning goals.</p>
  </div>;
}
