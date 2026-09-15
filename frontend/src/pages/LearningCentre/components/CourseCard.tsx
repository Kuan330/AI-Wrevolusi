import { Bookmark, ArrowRight, CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { durationLabel } from "../lib/coursePlanning";
import type { Course } from "../types";
export type CourseCardProps = {
  course: Course;
  saved: boolean;
  skillId: string;
  inPlan: boolean;
  scheduled: boolean;
  onSave: () => void;
  onDetails: () => void;
};
export default function CourseCard(props: CourseCardProps) {
  const { course, saved, skillId, inPlan, scheduled, onSave, onDetails } =
    props;
  return (
    <Card className="library-course library-glass">
      <div className="library-row">
        <p className="library-kicker">{course.provider}</p>
        <Button
          className="library-save-button"
          variant="ghost"
          size="sm"
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />{" "}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      <h3>{course.title} {scheduled && <span className="course-import-badge">In learning plan</span>}</h3>
      <div className="library-tags">
        <Badge variant="secondary">
          {course.level === "unknown" ? "Level not stated" : course.level}
        </Badge>
        <span>{durationLabel(course.durationMin)}</span>
        <span>{course.language}</span>
        <span>{course.selfPaced ? "Self-paced" : "Scheduled course"}</span>
      </div>
      <p className="learning-course-summary">{course.intro}</p>
      <p className="library-match">
        {course.match[skillId] ??
          "Related through course topics in our catalogue."}
      </p>
      <div className="library-row">
        <div>
          <small className="library-muted">
            {course.register === "required"
              ? "Free registration required"
              : "No registration required"}
          </small>
          {(inPlan || scheduled) && (
            <p className="learning-plan-status">
              <CalendarCheck size={14} />
              {scheduled ? "Scheduled" : "In My Plan · Unscheduled"}
            </p>
          )}
        </div>
        <Button variant="link" onClick={onDetails}>
          View details
          <ArrowRight size={16} />
        </Button>
      </div>
    </Card>
  );
}
