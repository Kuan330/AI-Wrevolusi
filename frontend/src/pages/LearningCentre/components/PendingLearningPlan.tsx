import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export type PendingLearningPlanProps = { waitingCount: number };
export default function PendingLearningPlan(props: PendingLearningPlanProps) {
  const { waitingCount } = props;
  return (
    <Card className="library-pending library-glass" id="learning-plan">
      <div className="library-row">
        <div>
          <p className="library-kicker">Make room for learning</p>
          <h2 className="my-2">Ready to make time for learning?</h2>
          <p className="library-muted">
            {waitingCount
              ? `${waitingCount} ${waitingCount === 1 ? "course is" : "courses are"} waiting to be scheduled.`
              : "Choose a course here, then manage your learning time in My Plan."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/plan">
            <CalendarDays size={16} />
            Open My Plan
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
