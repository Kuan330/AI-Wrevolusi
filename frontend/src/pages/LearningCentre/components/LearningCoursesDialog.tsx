import { useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { ROUTES } from "@/constants/routes";
import { commitLearningCoursesToPlan } from "@/pages/Plan/lib/planCourses";
import { loadCourseDirectory } from "../lib/courseDirectory";
import {
  courseLevelClassName,
  courseLevelLabel,
} from "../lib/courseLevels";
import type { Course } from "../types";

export type LearningCoursesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: string[];
  onRemove: (id: string) => void;
};

export default function LearningCoursesDialog(props: LearningCoursesDialogProps) {
  const { open, onOpenChange, saved, onRemove } = props;
  const navigate = useNavigate();
  const [directory, setDirectory] = useState<Map<string, Course> | null>(null);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);

  // Saved ids point at backend courses, so resolve them against the live
  // catalogue rather than a bundled list whose ids never matched.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadCourseDirectory()
      .then((next) => {
        if (cancelled) return;
        setDirectory(next);
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Your saved courses could not be loaded. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const items = saved.flatMap((id) => {
    const course = directory?.get(id);
    return course ? [course] : [];
  });
  const loading = !directory && !error;

  async function goToLearningPlan() {
    if (committing) return;
    setCommitting(true);
    setError("");
    try {
      await commitLearningCoursesToPlan(saved);
      onOpenChange(false);
      navigate(ROUTES.plan);
    } catch {
      setError(
        "Those courses could not be added to your plan. Please try again.",
      );
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="learning-courses-dialog">
        <DialogHeader className="learning-courses-dialog__header space-y-1 text-left">
          <DialogTitle>Learning courses</DialogTitle>
          <DialogDescription className="sr-only">
            Courses in your learning list. Open Learning plan to track them on
            My Plan.
          </DialogDescription>
        </DialogHeader>
        <div className="learning-courses-dialog__body">
          {loading ? (
            <p className="library-muted" role="status">
              Loading your courses…
            </p>
          ) : error ? (
            <p className="library-muted" role="alert">
              {error}
            </p>
          ) : !items.length ? (
            <div className="library-empty learning-courses-empty">
              <Bookmark className="mx-auto mb-3" />
              <p>No courses in your learning list yet.</p>
              <p>Browse by skill and choose Add to learning.</p>
            </div>
          ) : (
            <div className="learning-courses-list">
              {items.map((course) => (
                <article className="learning-course-card" key={course.id}>
                  <div className="learning-course-card__body">
                    <p className="library-kicker">{course.provider}</p>
                    <h3>{course.title}</h3>
                    <p className="learning-course-card__meta">
                      <span className={courseLevelClassName(course.level)}>
                        {courseLevelLabel(course.level)}
                      </span>
                      {" · "}
                      {course.language}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="learning-course-card__remove soft-btn-red"
                    aria-label={`Remove ${course.title} from learning courses`}
                    onClick={() => onRemove(course.id)}
                  >
                    <Trash2 size={14} />
                    Remove
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="learning-courses-dialog__footer">
          <Button
            type="button"
            variant="outline"
            className="soft-btn-gray"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <AppButton
            tone="gradient"
            type="button"
            disabled={!items.length || committing}
            onClick={() => void goToLearningPlan()}
          >
            {committing ? "Adding…" : "Learning plan"}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
