import type { MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAccount } from "@/components/account/useAccount";
import { useBotPetGreeting } from "@/hooks/useBotPetGreeting";
import ExposureScorePie from "@/pages/AIExposure/components/ExposureScorePie";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { message } from "@/components/ui/message";
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
import { readLearningSkills } from "@/pages/Skills/learningSkills";
import {
  flushWorkspace,
  hasAccountWorkspace,
} from "@/services/accountStorage";
import { ApiError } from "@/services/api";
import {
  getLearningCalendar,
  postLearningCheckin,
  postLearningDailyBrief,
  postLearningProgress,
  type CalendarDay,
  type DailyBriefResponse,
} from "@/services/learningService";
import {
  readPlanState,
  savePlanState,
  syncPlanWithLearningCourses,
  type PlanCourse,
  type PlanDayChapterEntry,
  type PlanRecordDay,
  type PlanState,
} from "@/pages/Plan/lib/planCourses";
import {
  buildBriefTourSteps,
  briefTourStorageKey,
  hasSeenBriefTour,
  markBriefTourSeen,
} from "./PlanDailyBrief";
import "@/pages/LearningCentre/course-library.css";
import "./learning-preview.css";

type Course = PlanCourse;
type RecordDay = PlanRecordDay;
type Preview = PlanState;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const localHour = (d = new Date()) => d.getHours();

const emptyRecord = (): RecordDay => ({
  minutes: 0,
  note: "",
  studied: false,
  checked: false,
  entries: [],
});

function dayHasProgress(r: RecordDay | undefined) {
  return Boolean(r && (r.checked || r.studied || (r.entries?.length ?? 0) > 0));
}

function monthRange(month: Date) {
  const from = dateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const to = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return { from, to };
}

function briefSkillsFromPlan(courses: PlanCourse[]) {
  const fromCourses = courses
    .map((c) => c.skillId)
    .filter((id): id is string => Boolean(id));
  let fromLearning: string[] = [];
  try {
    fromLearning = (readLearningSkills() ?? []).map((s) => s.id);
  } catch {
    fromLearning = [];
  }
  return [...new Set([...fromCourses, ...fromLearning])].map((skill_id) => ({
    skill_id,
  }));
}

function mergeDayEntries(
  existing: PlanDayChapterEntry[] | undefined,
  next: PlanDayChapterEntry[],
): PlanDayChapterEntry[] {
  const map = new Map<string, PlanDayChapterEntry>();
  for (const entry of existing ?? []) {
    map.set(`${entry.courseId}::${entry.chapterTitle}`, entry);
  }
  for (const entry of next) {
    map.set(`${entry.courseId}::${entry.chapterTitle}`, entry);
  }
  return [...map.values()];
}

function initial(): Preview {
  return readPlanState();
}

function persist(next: Preview) {
  savePlanState(next);
  if (hasAccountWorkspace()) {
    void flushWorkspace().catch(() => {
      /* Local mirror already kept; workspace retry happens on next edit. */
    });
  }
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
  const { user } = useAccount();
  const [state, setState] = useState<Preview>(initial);
  const [today, setToday] = useState(dateKey);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [courseId, setCourseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<number[]>([]);
  const [recordDate, setRecordDate] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [calendarDays, setCalendarDays] = useState<Record<string, CalendarDay>>(
    {},
  );
  const [streakDays, setStreakDays] = useState(0);
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefStep, setBriefStep] = useState(0);
  const [briefTourOpen, setBriefTourOpen] = useState(false);
  /** After finishing today's brief once this visit, don't chain into entry greeting. */
  const [briefFinishedSession, setBriefFinishedSession] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  // The drawer opens programmatically, so Radix has no trigger to restore focus
  // to on close; remember the button that opened it instead.
  const detailOpener = useRef<HTMLButtonElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  // Raw text of a chapter's percent field while it is being typed, so the value
  // is clamped on commit instead of fighting the caret on every keystroke.
  const [rawPercent, setRawPercent] = useState<Record<string, string>>({});

  const planReady = !coursesLoading;
  const briefKey = brief ? briefTourStorageKey(brief) : null;
  const briefTourPending =
    Boolean(briefKey) && briefKey !== null && !hasSeenBriefTour(briefKey);
  // Brief tour first; once finished for this variant, normal Plan entry tips apply.
  const { speech: petSpeech, say: sayPet } = useBotPetGreeting("plan", {
    ready: planReady && !briefLoading,
    skipEntry:
      briefLoading ||
      briefTourOpen ||
      briefTourPending ||
      briefFinishedSession,
  });

  const refreshCalendar = useCallback(async (targetMonth: Date) => {
    if (!hasAccountWorkspace()) return;
    const { from, to } = monthRange(targetMonth);
    try {
      const res = await getLearningCalendar(from, to);
      const next: Record<string, CalendarDay> = {};
      for (const day of res.days) next[day.day] = day;
      setCalendarDays(next);
      setStreakDays(res.streak_days);
    } catch {
      /* Keep local calendar lights when the API is unreachable. */
    }
  }, []);

  const refreshBrief = useCallback(
    async (courses: PlanCourse[], day = dateKey()) => {
      if (!hasAccountWorkspace()) {
        setBrief(null);
        setBriefLoading(false);
        return;
      }
      const skills = briefSkillsFromPlan(courses);
      if (!skills.length) {
        setBrief(null);
        setBriefLoading(false);
        return;
      }
      setBriefLoading(true);
      try {
        const next = await postLearningDailyBrief(
          day,
          localHour(),
          user?.username?.trim() || null,
          skills,
        );
        setBrief(next);
        setStreakDays(next.streak_days);
      } catch {
        setBrief(null);
      } finally {
        setBriefLoading(false);
      }
    },
    [user?.username],
  );

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
    if (coursesLoading) return;
    void refreshCalendar(month);
  }, [coursesLoading, month, refreshCalendar]);

  useEffect(() => {
    if (coursesLoading) return;
    void refreshBrief(state.courses, today);
  }, [coursesLoading, state.courses, today, refreshBrief]);

  useEffect(() => {
    if (!brief || !briefKey) {
      setBriefTourOpen(false);
      return;
    }
    if (hasSeenBriefTour(briefKey)) {
      setBriefTourOpen(false);
      return;
    }
    setBriefStep(0);
    setBriefTourOpen(true);
    setBriefFinishedSession(false);
  }, [brief, briefKey]);

  function finishBriefTour() {
    if (briefKey) markBriefTourSeen(briefKey);
    setBriefTourOpen(false);
    setBriefFinishedSession(true);
  }

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
  const checkedDays = useMemo(() => {
    const fromApi = Object.values(calendarDays).filter(
      (d) => d.day.startsWith(monthPrefix) && d.checked_in,
    ).length;
    if (fromApi > 0 || Object.keys(calendarDays).length > 0) return fromApi;
    return Object.entries(state.records).filter(
      ([day, r]) => day.startsWith(monthPrefix) && Boolean(r.checked),
    ).length;
  }, [calendarDays, monthPrefix, state.records]);
  const viewRecord = recordDate ? state.records[recordDate] : undefined;
  const viewApiDay = recordDate ? calendarDays[recordDate] : undefined;
  const viewEntries = viewRecord?.entries ?? [];
  const viewChecked = viewApiDay
    ? viewApiDay.checked_in
    : Boolean(viewRecord?.checked);
  const viewStudied = viewApiDay
    ? viewApiDay.studied || viewApiDay.checked_in
    : dayHasProgress(viewRecord);
  const inProgress = state.courses.filter(
    (c) => percent(c) > 0 && percent(c) < 100,
  ).length;

  const briefSteps = useMemo(
    () => (brief ? buildBriefTourSteps(brief) : []),
    [brief],
  );

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
    setRecordDate(day);
  }

  async function handleCheckIn() {
    if (checkInBusy) return;
    setCheckInBusy(true);
    try {
      const res = await postLearningCheckin(today);
      setStreakDays(res.streak_days);
      message.success(
        res.created
          ? `Checked in · ${res.streak_days} day streak`
          : `Already checked in · ${res.streak_days} day streak`,
      );
      sayPet("plan-record");
      const previous = state.records[today] ?? emptyRecord();
      save({
        ...state,
        records: {
          ...state.records,
          [today]: { ...previous, checked: true, studied: true },
        },
      });
      await refreshCalendar(month);
      await refreshBrief(state.courses, today);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        message.warning(
          error.detail ||
            "Log some chapter progress first, then check in.",
        );
      } else {
        message.error("Could not check in. Please try again.");
      }
    } finally {
      setCheckInBusy(false);
    }
  }

  const briefTourStep = briefSteps[briefStep];
  const petTour =
    briefTourOpen && briefSteps.length > 0 && briefTourStep
      ? {
          text: briefTourStep.text,
          step: briefStep,
          total: briefSteps.length,
          widthRem: briefTourStep.widthRem,
          onNext: () => {
            if (briefStep >= briefSteps.length - 1) {
              finishBriefTour();
              return;
            }
            setBriefStep((current) => current + 1);
          },
          onDismiss: finishBriefTour,
          primaryLabel:
            briefTourStep.action === "checkin" ? "Check in" : undefined,
          onPrimary:
            briefTourStep.action === "checkin"
              ? () => {
                  void handleCheckIn();
                }
              : undefined,
          primaryBusy: checkInBusy,
        }
      : null;

  function updateProgress() {
    if (!course) return;
    const bumps: PlanDayChapterEntry[] = course.chapters.flatMap((ch, i) => {
      const next = draft[i] ?? ch.value;
      if (next <= ch.value) return [];
      return [
        {
          courseId: course.id,
          courseTitle: course.title,
          chapterTitle: ch.title,
          percent: next * 10,
        },
      ];
    });
    const changed = bumps.length > 0;
    const day = dateKey();
    const previous = state.records[day] ?? emptyRecord();
    const nextCourses = state.courses.map((c) =>
      c.id === course.id
        ? {
            ...c,
            chapters: c.chapters.map((ch, i) => ({
              ...ch,
              value: Math.max(ch.value, draft[i]),
            })),
          }
        : c,
    );
    const nextState: Preview = {
      ...state,
      courses: nextCourses,
      records: changed
        ? {
            ...state.records,
            [day]: {
              ...previous,
              studied: true,
              // Check-in is an explicit action; save only marks studied.
              checked: previous.checked,
              entries: mergeDayEntries(previous.entries, bumps),
            },
          }
        : state.records,
    };
    save(nextState);
    setCourseId(null);
    setToday(day);
    if (changed) {
      message.success("Chapter progress saved.");
      sayPet("save-progress");
    } else {
      message.info("No changes to save.");
    }
    setNotice(
      changed ? "Chapter progress saved." : "No changes to save.",
    );

    if (changed && hasAccountWorkspace() && course.skillId) {
      const payload = bumps.flatMap((entry) => {
        const index = course.chapters.findIndex(
          (ch) => ch.title === entry.chapterTitle,
        );
        if (index < 0 || !course.skillId) return [];
        return [
          {
            skill_id: course.skillId,
            course_id: course.id,
            chapter_index: index,
            value: Math.round(entry.percent / 10),
          },
        ];
      });
      if (payload.length) {
        void postLearningProgress(day, payload)
          .then(async (res) => {
            if (res.rejected.length) {
              message.warning(
                "Some chapter values could not be saved. Progress only moves forward.",
              );
            }
            await refreshCalendar(month);
            await refreshBrief(nextCourses, day);
          })
          .catch(() => {
            /* Local mirror already kept; retry on next edit. */
          });
      }
    } else if (changed) {
      void refreshCalendar(month);
    }
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
            Record
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
            <article className="lp-stats-card lp-stats-card--checkins">
              <div className="lp-stats-card__icon" aria-hidden="true">
                <Check size={18} />
              </div>
              <div className="lp-stats-card__body">
                <p className="lp-kicker">Check-ins this month</p>
                <strong>
                  {checkedDays}
                  <span> {checkedDays === 1 ? "day" : "days"}</span>
                </strong>
                <span>
                  {streakDays > 0
                    ? `${streakDays}-day streak · `
                    : null}
                  {month.toLocaleDateString("en", { month: "long" })}
                </span>
              </div>
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
                    const apiDay = calendarDays[day];
                    const checked = apiDay
                      ? apiDay.checked_in
                      : Boolean(r?.checked);
                    const studied = apiDay
                      ? apiDay.studied || apiDay.checked_in
                      : dayHasProgress(r);
                    const lit = checked || studied;
                    return (
                      <button
                        type="button"
                        key={day}
                        disabled={day > today}
                        className={cn(
                          day === today && "is-today",
                          studied && !checked && "studied",
                          checked && "checked",
                        )}
                        onClick={() => openRecord(day)}
                        aria-label={`${day}${
                          checked
                            ? ", checked in"
                            : studied
                              ? ", studied"
                              : ""
                        }`}
                        aria-current={day === today ? "date" : undefined}
                      >
                        <span className="lp-day-num">{i + 1}</span>
                        {lit ? (
                          <img
                            className="lp-day-star"
                            src="/images/icons/icon-star.svg"
                            alt=""
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                {Array.from({ length: trailing }, (_, i) => (
                  <span key={`trail${i}`} />
                ))}
              </div>
                <div className="lp-legend">
                  <span>Checked in</span>
                  <span>Studied · not checked in</span>
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
                    View today
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
        storageKey="aiwrevolusi.botPetPosition.plan.v3"
        defaultAnchorRef={calendarRef}
        speech={
          petSpeech ?? (briefLoading ? "Preparing your briefing…" : null)
        }
        tour={petTour}
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
        <DialogContent className="lp-modal lp-modal--day">
          <DialogTitle>Day progress · {recordDate}</DialogTitle>
          <DialogDescription>
            {viewChecked
              ? "Checked in for this day."
              : viewStudied
                ? "Chapter progress logged — check in when you are ready."
                : "View-only snapshot of chapter progress saved on this day."}
          </DialogDescription>
          {viewEntries.length ? (
            <div className="lp-day-view">
              <p className="lp-day-view__summary">
                {viewEntries.length} chapter
                {viewEntries.length === 1 ? "" : "s"} logged
                {viewApiDay?.chapters_touched
                  ? ` · ${viewApiDay.chapters_touched} on server`
                  : ""}
              </p>
              <ul className="lp-day-view__list">
                {viewEntries.map((entry) => (
                  <li
                    key={`${entry.courseId}-${entry.chapterTitle}`}
                    className="lp-day-view__item"
                  >
                    <div>
                      <strong>{entry.chapterTitle}</strong>
                      <small>{entry.courseTitle}</small>
                    </div>
                    <span>{entry.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="lp-day-view__empty">
              {viewStudied
                ? "Progress is on the server for this day, but no local chapter list is stored yet."
                : "No chapter progress was saved on this day yet. Open a course and use Save progress to log today."}
            </p>
          )}
          <div className="lp-day-view__foot">
            {recordDate === today &&
            !viewChecked &&
            hasAccountWorkspace() ? (
              <button
                type="button"
                className="soft-btn-blue"
                disabled={checkInBusy}
                onClick={() => {
                  void handleCheckIn();
                }}
              >
                {checkInBusy ? "Checking in…" : "Check in today"}
              </button>
            ) : null}
            <button
              type="button"
              className="soft-btn-blue"
              onClick={() => setRecordDate(null)}
            >
              Close
            </button>
          </div>
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
          <div className="lp-modal__actions">
            <button
              type="button"
              className="soft-btn-gray"
              onClick={() => setRemoveId(null)}
            >
              Keep course
            </button>
            <button
              type="button"
              className="soft-btn-blue"
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
                message.success("Course removed from your plan.");
                sayPet("remove-item");
              }}
            >
              Remove course
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
