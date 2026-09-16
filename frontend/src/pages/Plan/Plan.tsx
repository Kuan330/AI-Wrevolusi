import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import BotPet from "@/components/common/BotPet";
import DataTable from "@/components/common/DataTable";
import type { DataTableColumn } from "@/components/common/DataTable";
import PageHeader from "@/components/common/PageHeader";
import ExposureScorePie from "@/pages/AIExposure/components/ExposureScorePie";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import SoftPercentField from "@/components/ui/soft-percent-field";
import { GradientBar } from "@/components/ui/gradient-bar";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import {
  readLibrary,
  saveLibrary,
} from "@/pages/LearningCentre/lib/libraryStorage";
import {
  readPlanState,
  savePlanState,
  syncPlanWithLearningCourses,
  type PlanChapter,
  type PlanCourse,
  type PlanRecordDay,
  type PlanState,
} from "@/pages/Plan/lib/planCourses";
import "@/pages/LearningCentre/course-library.css";
import "./learning-preview.css";

type Chapter = PlanChapter;
type Course = PlanCourse;
type RecordDay = PlanRecordDay;
type Preview = PlanState;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyRecord = (): RecordDay => ({
  minutes: 0,
  note: "",
  studied: false,
  checked: false,
});

function initial(): Preview {
  return readPlanState();
}

function persist(next: Preview) {
  savePlanState(next);
}

const percent = (c: Course) =>
  c.chapters.length
    ? Math.round(
        (c.chapters.reduce((n, ch) => n + ch.value, 0) /
          (c.chapters.length * 10)) *
          100,
      )
    : 0;

const doneCount = (c: Course) => c.chapters.filter((ch) => ch.value === 10).length;

/** Drives the Status column: not started, in progress, or complete. */
function courseStatus(c: Course) {
  const value = percent(c);
  if (value === 0) return { key: "start", label: "Start" } as const;
  if (value === 100) return { key: "finished", label: "Finished" } as const;
  return { key: "continue", label: "Continue" } as const;
}

export default function Plan() {
  const location = useLocation();
  const [state, setState] = useState<Preview>(initial);
  const [today, setToday] = useState(dateKey);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [courseId, setCourseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [recordDate, setRecordDate] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("25");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  // The drawer opens programmatically, so Radix has no trigger to restore focus
  // to on close; remember the button that opened it instead.
  const detailOpener = useRef<HTMLButtonElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  // Raw text of a chapter's percent field while it is being typed, so the value
  // is clamped on commit instead of fighting the caret on every keystroke.
  const [rawPercent, setRawPercent] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    void syncPlanWithLearningCourses()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(readPlanState());
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.key]);

  useEffect(() => {
    const refresh = () => setToday(dateKey());
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  function save(next: Preview) {
    setState(next);
    try {
      persist(next);
    } catch {
      setNotice(
        "Changes are available until you leave this page; browser storage is unavailable.",
      );
    }
  }

  const course = state.courses.find((c) => c.id === courseId);
  // The drawer summary must follow the draft values, not only the saved ones.
  const draftValues = course
    ? course.chapters.map((ch, i) => draft[i] ?? ch.value)
    : [];
  const draftDone = draftValues.filter((v) => v === 10).length;
  const draftPercent = course?.chapters.length
    ? Math.round(
        (draftValues.reduce((n, v) => n + v, 0) / (course.chapters.length * 10)) *
          100,
      )
    : 0;
  const chapters = state.courses.flatMap((c) => c.chapters);
  const overall = chapters.length
    ? Math.round(
        (chapters.reduce((n, c) => n + c.value, 0) / (chapters.length * 10)) *
          100,
      )
    : 0;
  const monthPrefix = dateKey(month).slice(0, 7);
  const checkedDays = Object.entries(state.records).filter(
    ([day, r]) => day.startsWith(monthPrefix) && r.checked,
  ).length;
  const inProgress = state.courses.filter(
    (c) => percent(c) > 0 && percent(c) < 100,
  ).length;

  function openCourse(c: Course) {
    setCourseId(c.id);
    setDraft(c.chapters.map((ch) => ch.value));
    setRawPercent({});
  }

  /**
   * Chapter progress can only increase, so the saved value is the floor. Typing
   * is committed on blur or Enter: the value is snapped to the 10% grid and
   * clamped into [saved, 100].
   */
  function commitChapter(index: number, title: string, typedOverride?: string) {
    const typed = typedOverride ?? rawPercent[title];
    setRawPercent((prev) => {
      const next = { ...prev };
      delete next[title];
      return next;
    });
    const chapter = course?.chapters[index];
    if (typed === undefined || !chapter) return;
    const parsed = Number.parseInt(typed, 10);
    if (!Number.isFinite(parsed)) return;
    const floor = chapter.value * 10;
    const next = Math.min(100, Math.max(floor, Math.round(parsed / 10) * 10));
    setDraft((current) =>
      current.map((value, i) => (i === index ? next / 10 : value)),
    );
  }

  function openRecord(day: string) {
    const r = state.records[day];
    setRecordDate(day);
    setMinutes(String(r?.minutes ?? 25));
    setNote(r?.note ?? "");
  }

  function updateProgress() {
    if (!course) return;
    const changed = draft.some((v, i) => v > course.chapters[i].value);
    const day = dateKey();
    save({
      ...state,
      courses: state.courses.map((c) =>
        c.id === course.id
          ? {
              ...c,
              chapters: c.chapters.map((ch, i) => ({
                ...ch,
                value: Math.max(ch.value, draft[i]),
              })),
            }
          : c,
      ),
      records: changed
        ? {
            ...state.records,
            [day]: {
              ...(state.records[day] ?? emptyRecord()),
              studied: true,
            },
          }
        : state.records,
    });
    setCourseId(null);
    setToday(day);
    setNotice(
      changed
        ? "Chapter progress saved. You can now check in for today."
        : "No changes to save.",
    );
  }

  const offset = (month.getDay() + 6) % 7;
  const dayCount = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const trailing = (7 - ((offset + dayCount) % 7)) % 7;

  const courseColumns: DataTableColumn<Course>[] = [
    {
      id: "course",
      header: "Course",
      width: "30%",
      sortValue: (c) => c.title.toLowerCase(),
      cell: (c) => (
        <span className="lp-cell-course">
          <span className="lp-cell-course__copy">
            <strong>{c.title}</strong>
            <small>{c.provider}</small>
          </span>
        </span>
      ),
    },
    {
      id: "progress",
      header: "Progress",
      width: "24%",
      sortValue: (c) => percent(c),
      cell: (c) => (
        <span className="lp-cell-progress">
          <GradientBar
            size="sm"
            value={percent(c)}
            className="lp-bar"
            aria-label={`${c.title} progress ${percent(c)}%`}
          />
          <span className="lp-bar__value">{percent(c)}%</span>
        </span>
      ),
    },
    {
      id: "chapters",
      header: "Chapters",
      width: "13%",
      align: "center",
      sortValue: (c) => doneCount(c),
      cell: (c) => (
        <span className="lp-cell-muted">
          {doneCount(c)} / {c.chapters.length}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "13%",
      align: "center",
      sortValue: (c) => percent(c),
      cell: (c) => {
        const s = courseStatus(c);
        return (
          <span className={cn("lp-status", `lp-status--${s.key}`)}>
            {s.label}
          </span>
        );
      },
    },
    {
      id: "action",
      header: "Action",
      width: "20%",
      align: "center",
      cell: (c) => (
        <span className="lp-cell-actions">
          <button
            type="button"
            className="lp-text-action lp-text-action--blue"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              detailOpener.current = e.currentTarget;
              openCourse(c);
            }}
          >
            Detail
          </button>
          <button
            type="button"
            className="lp-text-action lp-text-action--red"
            onClick={() => setRemoveId(c.id)}
          >
            Remove
          </button>
        </span>
      ),
    },
  ];

  return (
    <div className="lp-page">
      <PageHeader
        className="lp-page-header"
        title="My Plan"
        description="Small steps, steady progress. Make your learning journey your own."
      />

      <p className="lp-notice" role="status">
        {notice}
      </p>

      <div className="lp-layout">
        <aside className="lp-left">
          <div className="lp-stats">
            <ExposureScorePie
              className="lp-stats-pie"
              score={overall / 100}
              label="Overall chapter progress"
              meta={`${overall}% complete`}
              variant="tasks"
            />
            <article className="lp-stats-card">
              <Check size={15} />
              <strong>{checkedDays} days</strong>
              <span>
                Check-ins ·{" "}
                {month.toLocaleDateString("en", { month: "long" })}
              </span>
            </article>
          </div>

          <section className="lp-calendar">
            <div className="lp-heading">
              <div>
                <p className="lp-kicker">EVERY SMALL STEP COUNTS</p>
                <h2>Learning calendar</h2>
              </div>
            </div>
            <div className="lp-mini-month" ref={calendarRef}>
              <div className="lp-month">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <ChevronLeft size={14} />
                </button>
                <strong>
                  {month.toLocaleDateString("en", {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="lp-mini-grid">
                {WEEKDAYS.map((d) => (
                  <span className="lp-mini-weekday" key={d}>
                    {d.charAt(0)}
                  </span>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`lead${i}`} />
                ))}
                {Array.from({ length: dayCount }, (_, i) => {
                  const day = dateKey(
                    new Date(month.getFullYear(), month.getMonth(), i + 1),
                  );
                  const r = state.records[day];
                  return (
                    <button
                      type="button"
                      key={day}
                      disabled={day > today}
                      className={cn(
                        day === today && "is-today",
                        r?.checked ? "checked" : r?.studied ? "studied" : "",
                      )}
                      onClick={() => openRecord(day)}
                      aria-label={`${day}${r?.checked ? ", checked in" : r?.studied ? ", learning recorded" : ""}`}
                      aria-current={day === today ? "date" : undefined}
                    >
                      {i + 1}
                      {r?.minutes ? <small>{r.minutes} min</small> : null}
                    </button>
                  );
                })}
                {Array.from({ length: trailing }, (_, i) => (
                  <span key={`trail${i}`} />
                ))}
              </div>
              <div className="lp-legend">
                <span>Checked in</span>
                <span>Learned, not checked in</span>
              </div>
            </div>
          </section>
        </aside>

        <section className="lp-courses">
          <div className="lp-heading">
            <div>
              <p className="lp-kicker">YOUR LEARNING JOURNEY</p>
              <h2>My courses</h2>
            </div>
          </div>
          <div className="lp-courses-panel">
            <DataTable
              className="lp-courses-table"
              rows={state.courses}
              columns={courseColumns}
              rowKey={(c) => c.id}
              caption="Your courses with progress, chapter counts and status."
              initialSort={{ columnId: "progress", direction: "desc" }}
              emptyState={
                <div className="lp-empty">
                  <h3>
                    {coursesLoading
                      ? "Loading your courses…"
                      : "No courses on your plan yet"}
                  </h3>
                  {!coursesLoading ? (
                    <p>
                      Add courses from Learning Resources, then return here to
                      track progress.
                    </p>
                  ) : null}
                </div>
              }
            />
            <div className="lp-courses-footer">
              <div className="lp-table-actions">
                <span className="lp-table-actions__meta">
                  {inProgress} of {state.courses.length} in progress
                </span>
                <div className="lp-table-actions__buttons">
                  <button
                    type="button"
                    className="lp-mini lp-mini--blue"
                    onClick={() => openRecord(dateKey())}
                  >
                    Record learning
                  </button>
                  <Link
                    to={ROUTES.learningCentre}
                    className="lp-mini lp-mini--gradient"
                  >
                    Add course
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <BotPet
        storageKey="aiwrevolusi.botPetPosition.plan.v1"
        defaultAnchorRef={calendarRef}
      />

      <Drawer
        open={!!course}
        onOpenChange={(v) => {
          if (!v) setCourseId(null);
        }}
      >
        <DrawerContent
          className="lp-drawer"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            detailOpener.current?.focus();
          }}
        >
          {course && (
            <>
              <DrawerHeader>
                <p className="lp-kicker">{course.provider}</p>
                <DrawerTitle className="lp-drawer-title">
                  {course.title}
                </DrawerTitle>
                <DrawerDescription>
                  Chapter progress is a percentage and can only increase, so
                  each field starts at the value you already saved.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <ol className="lp-drawer-list">
                  {course.chapters.map((ch, i) => {
                    const savedComplete = ch.value === 10;
                    const floorPercent = ch.value * 10;
                    const chapterPercent = (draft[i] ?? ch.value) * 10;
                    const complete = chapterPercent === 100;
                    return (
                      <li className="lp-drawer-chapter" key={ch.title}>
                        <div className="lp-drawer-chapter__head">
                          <span className="lp-drawer-chapter__name">
                            {i + 1}. {ch.title}
                          </span>
                          <SoftPercentField
                            min={floorPercent}
                            max={100}
                            step={10}
                            readOnly={savedComplete}
                            value={
                              rawPercent[ch.title] ?? String(chapterPercent)
                            }
                            aria-label={`${ch.title} progress percentage`}
                            onValueChange={(next) =>
                              setRawPercent((prev) => ({
                                ...prev,
                                [ch.title]: next,
                              }))
                            }
                            onCommit={(next) =>
                              commitChapter(i, ch.title, next)
                            }
                          />
                        </div>
                        <div className="lp-drawer-chapter__bar">
                          <GradientBar
                            size="sm"
                            value={chapterPercent}
                            aria-label={`${ch.title} progress ${chapterPercent}%`}
                          />
                        </div>
                        <div className="lp-drawer-chapter__foot">
                          <span className="lp-drawer-chapter__hint">
                            {savedComplete
                              ? "Chapter complete"
                              : complete
                                ? "Will be saved as complete"
                                : floorPercent > 0
                                  ? `Saved ${floorPercent}% · can only increase`
                                  : "Not started · any value up to 100%"}
                          </span>
                          {savedComplete ? (
                            <span className="lp-drawer-chapter__done">
                              Complete
                            </span>
                          ) : complete ? (
                            <span className="lp-drawer-chapter__pending">
                              Ready to save
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </DrawerBody>
              <div className="lp-drawer-foot">
                <div className="lp-overall">
                  <p className="lp-kicker">Overall progress</p>
                  <strong>{draftPercent}%</strong>
                  <span>
                    {draftDone} of {course.chapters.length} chapters complete
                  </span>
                </div>
                <button
                  type="button"
                  className="lp-drawer-save"
                  onClick={updateProgress}
                >
                  Save progress
                </button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <Dialog
        open={!!recordDate}
        onOpenChange={(v) => {
          if (!v) setRecordDate(null);
        }}
      >
        <DialogContent className="lp-modal">
          <DialogTitle>Learning record · {recordDate}</DialogTitle>
          <DialogDescription>
            Keep a note of what you learned. Saving a note does not mark
            chapters complete or check you in.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!recordDate) return;
              const value = Number(minutes);
              if (!Number.isInteger(value) || value < 0 || value > 1440) return;
              save({
                ...state,
                records: {
                  ...state.records,
                  [recordDate]: {
                    ...(state.records[recordDate] ?? emptyRecord()),
                    minutes: value,
                    note: note.trim(),
                  },
                },
              });
              setRecordDate(null);
              setNotice("Learning record saved.");
            }}
          >
            <label>
              Learning time (minutes)
              <input
                type="number"
                required
                min={0}
                max={1440}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <label>
              What did you learn?
              <textarea
                rows={4}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A small discovery, a useful idea, or something to revisit…"
              />
            </label>
            <button className="lp-primary" type="submit">
              Save learning record
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!removeId}
        onOpenChange={(v) => {
          if (!v) setRemoveId(null);
        }}
      >
        <DialogContent className="lp-modal">
          <DialogTitle>Remove this course from your plan?</DialogTitle>
          <DialogDescription>
            It will leave your learning list too. Daily notes on My Plan stay.
          </DialogDescription>
          <button className="lp-outline" onClick={() => setRemoveId(null)}>
            Keep course
          </button>
          <button
            className="lp-primary"
            onClick={() => {
              if (!removeId) return;
              save({
                ...state,
                courses: state.courses.filter((c) => c.id !== removeId),
              });
              try {
                const library = readLibrary();
                saveLibrary({
                  ...library,
                  saved: library.saved.filter((id) => id !== removeId),
                });
              } catch {
                /* Plan removal still succeeds if the learning list cannot update. */
              }
              setRemoveId(null);
              setNotice("Course removed from your plan.");
            }}
          >
            Remove course
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
