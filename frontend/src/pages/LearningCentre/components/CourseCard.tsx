import { Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { durationLabel } from "../lib/coursePlanning";
import {
  courseLevelClassName,
  courseLevelLabel,
} from "../lib/courseLevels";
import type { Course } from "../../../features/learning-planning/types";

export type CourseCardProps = {
  course: Course;
  saved: boolean;
  onSave: () => void;
  onDetails: () => void;
};

export default function CourseCard(props: CourseCardProps) {
  const { course, saved, onSave, onDetails } = props;
  return (
    <Card className="library-course library-glass">
      <div className="library-row">
        <p className="library-kicker">{course.provider}</p>
        <Button
          className={
            saved
              ? "library-save-button soft-btn-green"
              : "library-save-button soft-btn-blue"
          }
          variant="ghost"
          size="sm"
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />{" "}
          {saved ? "Added" : "Add to My Plan"}
        </Button>
      </div>
      <h3>{course.title}</h3>
      <div className="library-tags">
        <span className={courseLevelClassName(course.level)}>
          {courseLevelLabel(course.level)}
        </span>
        <span>{durationLabel(course.durationMin)}</span>
        <span>{course.language}</span>
        <span>{course.selfPaced ? "Self-paced" : "Scheduled course"}</span>
      </div>
      <div className="library-row">
        <small className="library-muted">
          {course.register === "required"
            ? "Free registration required"
            : "No registration required"}
        </small>
        <Button variant="link" onClick={onDetails}>
          View details
        </Button>
      </div>
    </Card>
  );
}
