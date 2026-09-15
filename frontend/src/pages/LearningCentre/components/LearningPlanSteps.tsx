import { TimePicker } from "@/components/ui/time-picker";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppButton } from "@/components/ui/app-button";
import { Radio } from "@/components/ui/radio";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/form-field";
import type { Course, CourseChoice } from "../types";
import {
  durationLabel,
  selectedMinutes,
  estimateLabel,
  validateChoice,
  weekdays,
} from "../lib/coursePlanning";
export type LearningPlanStepsProps = {
  course: Course;
  initialChoice: CourseChoice;
  inPlan: boolean;
  onBack: () => void;
  onClose: () => void;
  onCommit: (choice: CourseChoice) => boolean | Promise<boolean>;
};
export default function LearningPlanSteps(props: LearningPlanStepsProps) {
  const { course, initialChoice, inPlan, onBack, onClose, onCommit } = props;
  const navigate = useNavigate();
  const today = new Date();
  const dateMin = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<CourseChoice>({
    ...initialChoice,
    startDate: initialChoice.startDate || dateMin,
    startTime: initialChoice.startTime || "18:30",
    endTime: initialChoice.endTime || "19:00",
    scheduleMode:
      initialChoice.scheduleMode ??
      (initialChoice.weekdays.length ? "routine" : "later"),
  });
  const [partial, setPartial] = useState(
    !!course.chapters?.length &&
      choice.chapters.length !== course.chapters.length,
  );
  const [error, setError] = useState("");
  const allChapters = course.chapters?.map((_, index) => index) ?? [];
  const selected = {
    ...choice,
    chapters: partial ? choice.chapters : allChapters,
    minutesPerDay: (Number(choice.endTime?.slice(0, 2)) * 60 + Number(choice.endTime?.slice(3))) - (Number(choice.startTime?.slice(0, 2)) * 60 + Number(choice.startTime?.slice(3))),
  };
  const mode = choice.scheduleMode ?? "later";
  const [importError, setImportError] = useState("");
  const [saving, setSaving] = useState(false);
  async function commit() {
    const next =
      mode === "later"
        ? { ...selected, weekdays: [], startDate: undefined }
        : selected;
    const issue = validateChoice(course, next);
    if (issue) {
      setError(issue);
      return;
    }
    if (mode === "routine" && choice.startDate! < dateMin) {
      setError("Choose today or a future start date.");
      return;
    }
    setSaving(true);
    try {
      if (!await onCommit(next)) { setImportError("Could not save your learning plan. Please try again."); return; }
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not import your plan."); return; }
    finally { setSaving(false); }
    onClose();
    navigate(`/plan?resource=epic5-${course.id}`);
  }
  return (
    <div className="learning-plan-steps">
      <Dialog open={!!importError} onOpenChange={open => { if (!open) setImportError(''); }}><DialogContent><DialogTitle>Unable to import course</DialogTitle><DialogDescription>{importError}</DialogDescription><AppButton tone="gradient" onClick={() => setImportError('')}>Got it</AppButton></DialogContent></Dialog>
      <div className="learning-step-indicator" aria-label={`Step ${step} of 2`}>
        <span className={step === 1 ? "is-current" : ""}>
          1 · Choose content
        </span>
        <ArrowRight size={14} />
        <span className={step === 2 ? "is-current" : ""}>2 · Arrange time</span>
      </div>
      <div className="learning-step-body">
        {step === 1 ? (
          <>
            <h3>What would you like to learn?</h3>
            <p className="library-muted">
              Start with the whole course, or choose the chapters that matter to
              you.
            </p>
            <div className="learning-options">
              <label className={!partial ? "is-selected" : ""}>
                <Radio
                  name="content-choice"
                  checked={!partial}
                  onChange={() => setPartial(false)}
                />
                <span>
                  <strong>Entire course</strong>
                  <small>
                    {durationLabel(course.durationMin)}
                    {course.chapters?.length
                      ? ` · ${course.chapters.length} chapters`
                      : ""}
                  </small>
                </span>
              </label>
              {!!course.chapters?.length && (
                <label className={partial ? "is-selected" : ""}>
                  <Radio
                    name="content-choice"
                    checked={partial}
                    onChange={() => setPartial(true)}
                  />
                  <span>
                    <strong>Choose chapters</strong>
                    <small>Only selected chapters will be included.</small>
                  </span>
                </label>
              )}
            </div>
            {partial && (
              <div className="library-chapters learning-chapter-selection">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="link"
                    onClick={() =>
                      setChoice({ ...choice, chapters: allChapters })
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => setChoice({ ...choice, chapters: [] })}
                  >
                    Clear selection
                  </Button>
                </div>
                {course.chapters?.map((chapter, index) => (
                  <label key={index}>
                    <Checkbox
                      checked={choice.chapters.includes(index)}
                      onCheckedChange={(checked) =>
                        setChoice({
                          ...choice,
                          chapters: checked
                            ? [...new Set([...choice.chapters, index])].sort(
                                (a, b) => a - b,
                              )
                            : choice.chapters.filter((item) => item !== index),
                        })
                      }
                    />
                    <span>
                      {chapter.title}
                      <small>{durationLabel(chapter.min)}</small>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="learning-selection-summary">
              {course.chapters?.length
                ? `${selected.chapters.length} of ${course.chapters.length} chapters`
                : "Whole course"}{" "}
              · {durationLabel(selectedMinutes(course, selected))}
            </p>
          </>
        ) : (
          <>
            <h3>When would you like to learn?</h3>
            <p className="library-muted">
              Choose a weekly preference here. Confirm exact times and check
              conflicts in My Plan.
            </p>
            <div className="learning-options">
              <label className={mode === "later" ? "is-selected" : ""}>
                <Radio
                  name="schedule-mode"
                  checked={mode === "later"}
                  onChange={() =>
                    setChoice({ ...choice, scheduleMode: "later" })
                  }
                />
                <Clock3 size={20} />
                <span>
                  <strong>Schedule later</strong>
                  <small>
                    Keep this course in My Plan, without choosing dates.
                  </small>
                </span>
              </label>
              <label className={mode === "routine" ? "is-selected" : ""}>
                <Radio
                  name="schedule-mode"
                  checked={mode === "routine"}
                  onChange={() =>
                    setChoice({ ...choice, scheduleMode: "routine" })
                  }
                />
                <CalendarDays size={20} />
                <span>
                  <strong>Set a weekly routine</strong>
                  <small>A starting point you can adjust in My Plan.</small>
                </span>
              </label>
            </div>
            {mode === "routine" && (
              <div className="learning-routine">
                <label className="learning-date">
                  Start date
                  <Input
                    type="date"
                    value={choice.startDate ?? ""}
                    min={dateMin}
                    onChange={(event) =>
                      setChoice({ ...choice, startDate: event.target.value })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Preferred study days</legend>
                  <div className="library-weekdays">
                    {weekdays.map((day, index) => (
                      <Button
                        key={day}
                        variant={
                          choice.weekdays.includes(index)
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        aria-pressed={choice.weekdays.includes(index)}
                        onClick={() =>
                          setChoice({
                            ...choice,
                            weekdays: choice.weekdays.includes(index)
                              ? choice.weekdays.filter((item) => item !== index)
                              : [...choice.weekdays, index].sort(),
                          })
                        }
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Study time</legend>
                  <div className="pl-form-row">
                    <label>From<TimePicker value={choice.startTime} onChange={value => { setError(""); setChoice({ ...choice, startTime: value }); }} /></label>
                    <label>To<TimePicker value={choice.endTime} onChange={value => { setError(""); setChoice({ ...choice, endTime: value }); }} /></label>
                  </div>
                  <p className="library-muted">Starts today if the start time has not passed; otherwise from your next selected day. Sessions are imported together into My Plan.</p>
                </fieldset>
                {selectedMinutes(course, selected) === null && <label>Planned learning time (minutes)<Input type="number" min="1" max="100000" value={choice.estimatedMinutes ?? ''} onChange={event => { setError(''); setChoice({ ...choice, estimatedMinutes: Number(event.target.value) }); }} /><span className="library-muted">The provider has no duration for this content. Enter how much time you want to schedule.</span></label>}
                <p className="learning-selection-summary">
                  {estimateLabel(course, selected)}
                </p>
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive mt-4">
            {error}
          </p>
        )}
      </div>
      <div className="learning-drawer-actions">
        <Button
          variant="ghost"
          onClick={() => {
            setError("");
            if (step === 2) setStep(1);
            else onBack();
          }}
        >
          <ArrowLeft size={16} />
          Back
        </Button>
        <AppButton
          tone="gradient"
          disabled={saving}
          onClick={() => {
            if (step === 1) {
              if (course.chapters?.length && !selected.chapters.length) {
                setError("Select at least one chapter.");
                return;
              }
              setError("");
              setStep(2);
            } else commit();
          }}
        >
          {step === 1
            ? "Continue"
            : mode === "routine"
              ? "Import into My Plan"
              : inPlan
                ? "Update My Plan"
                : "Add to My Plan"}
          <ArrowRight size={16} />
        </AppButton>
      </div>
    </div>
  );
}
