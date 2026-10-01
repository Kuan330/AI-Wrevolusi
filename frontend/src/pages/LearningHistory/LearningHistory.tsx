import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";

import { useAccount } from "@/components/account/useAccount";
import PageHeader from "@/components/common/PageHeader";
import LearningTimeline from "@/components/dashboard/LearningTimeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form-field";
import { ROUTES } from "@/constants/routes";
import { learningActivities } from "@/features/dashboard/learningSummary";
import { useLearningSnapshot } from "@/hooks/useWorkspaceSnapshot";

const RECORDS_PER_PAGE = 20;

export default function LearningHistory() {
  const { data, error } = useLearningSnapshot();
  const { reload } = useAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const [limit, setLimit] = useState(RECORDS_PER_PAGE);

  const dateParam = searchParams.get("date");
  const selectedDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : undefined;

  function handleDateChange(date?: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);

      if (date) {
        next.set("date", date);
      } else {
        next.delete("date");
      }

      return next;
    });
    setLimit(RECORDS_PER_PAGE);
  }

  if (error) {
    return (
      <Card className="dashboard-panel" role="alert">
        <h1>Your learning records need attention</h1>
        <p>{error}</p>
        <Button onClick={reload}>Reload saved work</Button>
      </Card>
    );
  }

  if (!data) {
    return <p role="status">Loading your learning records…</p>;
  }

  const activities = learningActivities(data.plan, data.goals).filter(
    (activity) => !selectedDate || activity.date === selectedDate,
  );
  const visibleActivities = activities.slice(0, limit);
  const hasMoreRecords = activities.length > limit;
  const emptyMessage = selectedDate
    ? "No learning activities recorded on this day. Choose another date or view all records."
    : "As you record course progress, check in or add practice to a goal, your learning history appears here.";

  return (
    <div className="dashboard-page learning-history-page">
      <PageHeader
        title="Learning records"
        description="Browse your study, course progress and practice records. Filter by date to revisit a specific day."
        actions={
          <Button asChild variant="outline">
            <Link to={ROUTES.learningGoals}>
              My learning plan <ArrowRight size={16} />
            </Link>
          </Button>
        }
      />

      <div className="records-filter-bar">
        <label htmlFor="learning-record-date">Filter by date</label>
        <Input
          id="learning-record-date"
          type="date"
          value={selectedDate ?? ""}
          onChange={(event) => handleDateChange(event.target.value || undefined)}
          className="w-auto"
        />
        <span>
          {activities.length} {activities.length === 1 ? "record" : "records"}
        </span>
      </div>

      <Card className="dashboard-panel">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-eyebrow">SMALL STEPS, REAL RECORDS</p>
            <h2>
              {selectedDate ? `Activity on ${selectedDate}` : "Learning timeline"}
            </h2>
          </div>

          {selectedDate && (
            <Button variant="ghost" onClick={() => handleDateChange()}>
              All dates <X size={15} />
            </Button>
          )}
        </div>

        {activities.length > 0 ? (
          <LearningTimeline
            activities={visibleActivities}
            courses={data.plan.courses}
          />
        ) : (
          <p className="dashboard-empty-inline">{emptyMessage}</p>
        )}

        {hasMoreRecords && (
          <Button
            variant="outline"
            onClick={() => setLimit((value) => value + RECORDS_PER_PAGE)}
          >
            Show more records
          </Button>
        )}
      </Card>

      <p className="dashboard-footnote">
        Progress reflects recorded study and practice, not an assessment of skill
        mastery. Previous records remain available when you change your work or
        learning goals.
      </p>
    </div>
  );
}
