import { learningSession } from "@/pages/LearningCentre/lib/learningSession";
import type { ComponentProps } from "react";
import JourneyIntro from "@/components/account/JourneyIntro";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  MessageCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";
import {
  resources,
  readSelections,
  type Selection,
} from "@/pages/LearningCentre/resources";
import { demoResources, demoSelections } from "@/pages/LearningCentre/demoData";
import { localPlanRepository } from "@/services/planService";
import {
  addDays,
  conflicts,
  dateKey,
  duration,
  monday,
  overlaps,
  requestMessage,
  suggestions,
  validateEvent,
  whatsappLink,
  type PlanEvent,
  type PlanState,
} from "./planModel";
import "./plan.css";
const labels = {
  learning: "Learning",
  work: "Work",
  care: "Family & care",
  personal: "Personal & rest",
};
const readable = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
export default function Plan() {
  const [params] = useSearchParams();
  // Example content is opt-in only.
  const demo = import.meta.env.DEV && params.get("demo") === "1";
  return <PlanContent key={String(demo)} demo={demo} />;
}
function PlanContent(props: { demo: boolean }) {
  const { demo } = props;
  const location = useLocation();
  const repository = useMemo(() => localPlanRepository(demo), [demo]);
  const [state, setState] = useState<PlanState>({
    version: 1,
    revision: 0,
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [week, setWeek] = useState(monday(dateKey(new Date())));
  const [selectedId, setSelectedId] = useState("");
  const [editor, setEditor] = useState<PlanEvent | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [formError, setFormError] = useState("");
  const [helper, setHelper] = useState("");
  const [message, setMessage] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const catalogue = demo ? demoResources : resources;
  const [shortlist] = useState<Selection[]>(() =>
    demo
      ? Array.isArray(location.state?.shortlist)
        ? location.state.shortlist.filter(
            (s: Selection) =>
              s && demoResources.some((r) => r.id === s.resourceId),
          )
        : demoSelections
      : readSelections(),
  );
  useEffect(() => {
    let active = true;
    repository
      .load()
      .then((data) => {
        if (active) {
          setState(data);
          setSelectedId(data.events.find((e) => e.kind === "care")?.id || "");
          const requestedId = new URLSearchParams(location.search).get("resource");
          const selection = shortlist.find(item => item.resourceId === requestedId);
          const resource = catalogue.find(item => item.id === requestedId);
          if (selection && resource) {
            const existing = data.events.find(event => event.resourceId === resource.id);
            if (existing) {
              setWeek(monday(existing.date));
              setSelectedId(existing.id);
              setNotice("This course already has scheduled sessions. Review them before adding more.");
            } else {
              const draft = learningSession(resource, selection, dateKey(new Date()));
              setWeek(monday(draft.date));
              setEditor(draft);
              setNotice("Review your preferred date and session length. Choose an exact time before saving.");
            }
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, location.search, shortlist, catalogue]);
  async function commit(events: PlanEvent[]) {
    setBusy(true);
    setError("");
    try {
      const next = await repository.save({ ...state, events }, state.revision);
      setState(next);
      setNotice("Plan saved. Account sync runs automatically.");
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const visible = state.events.filter((e) => days.includes(e.date));
  const pairs = conflicts(visible);
  const selected = state.events.find((e) => e.id === selectedId);
  const selectedConflicts = selected
    ? state.events.filter((e) => overlaps(selected, e))
    : [];
  const learning = visible.filter((e) => e.kind === "learning");
  function newEvent(resourceId?: string) {
    const resource = catalogue.find((r) => r.id === resourceId);
    setFormError("");
    setRepeat(false);
    setEditor(learningSession(resource, shortlist.find(item => item.resourceId === resourceId), week < dateKey(new Date()) ? dateKey(new Date()) : week));
  }
  async function saveEvent() {
    if (!editor) return;
    const validation = validateEvent(editor);
    if (validation) {
      setFormError(validation);
      return;
    }
    const previous = state.events.find((e) => e.id === editor.id);
    const changed =
      previous &&
      (previous.date !== editor.date ||
        previous.start !== editor.start ||
        previous.end !== editor.end ||
        previous.title !== editor.title ||
        previous.shareable !== editor.shareable);
    const event = {
      ...editor,
      title: editor.title.trim(),
      assistance: changed ? undefined : editor.assistance,
    };
    let events = state.events.filter((e) => e.id !== event.id).concat(event);
    if (repeat && !previous)
      events = events.concat(
        [1, 2, 3].map((i) => ({
          ...event,
          id: crypto.randomUUID(),
          date: addDays(event.date, i * 7),
        })),
      );
    if (await commit(events)) {
      setEditor(null);
      setSelectedId(event.id);
      setWeek(monday(event.date));
      if (changed && previous.assistance)
        setNotice(
          "Updated. The previous assistance confirmation has been cleared; contact your helper about the change.",
        );
    }
  }
  function openRequest() {
    if (!selected) return;
    const name = selected.assistance?.name || "";
    setHelper(name);
    setMessage(
      selected.assistance?.message || requestMessage(selected, name || "there"),
    );
    setFormError("");
    setRequestOpen(true);
  }
  async function saveRequest() {
    if (!selected) return;
    if (!helper.trim() || !message.trim()) {
      setFormError("Enter a helper name and message.");
      return;
    }
    if (
      await commit(
        state.events.map((e) =>
          e.id === selected.id
            ? {
                ...e,
                assistance: {
                  name: helper.trim(),
                  message,
                  status: "draft",
                  updatedAt: new Date().toISOString(),
                },
              }
            : e,
        ),
      )
    )
      setRequestOpen(false);
  }
  async function status(status: "pending" | "accepted" | "declined") {
    if (!selected?.assistance) return;
    await commit(
      state.events.map((e) =>
        e.id === selected.id
          ? {
              ...e,
              assistance: {
                ...selected.assistance!,
                status,
                updatedAt: new Date().toISOString(),
              },
            }
          : e,
      ),
    );
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Message copied.");
    } catch {
      setNotice("Copy unavailable. Select and copy the message text below.");
    }
  }
  const busyOrLoading = busy || loading;
  if (!demo && !loading && !error && !state.events.length && !shortlist.length)
    return <JourneyIntro kind="plan" />;
  const dialogProps1 = {
    open: !!editor,
    onOpenChange: (open) => {
      if (!open && !busy) setEditor(null);
    },
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  const dialogProps2 = {
    open: requestOpen,
    onOpenChange: (open) => {
      if (!busy) setRequestOpen(open);
    },
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  const dialogProps3 = {
    open: deleteOpen,
    onOpenChange: setDeleteOpen,
  } satisfies Partial<ComponentProps<typeof Dialog>>;
  return (
    <div className="pl-page">
      <PageHeader
        title="My Plan"
        description="Make room for learning, everyday life and the people who matter."
        actions={
          <button
            className="pl-primary"
            disabled={busyOrLoading || !!error}
            onClick={() => newEvent()}
          >
            <Plus size={16} /> Add an activity
          </button>
        }
      />
      {demo && (
        <div className="pl-demo">
          <span>
            <strong>Demo plan</strong> · Example activities and conflicts.
            Changes are saved separately from your own plan.
          </span>
          <Link to={`${ROUTES.plan}?demo=0`}>Exit demo</Link>
        </div>
      )}
      <div className="pl-summary">
        <div>
          <BookOpen />
          <span>
            <strong>{learning.reduce((n, e) => n + duration(e), 0)} min</strong>
            learning planned
          </span>
        </div>
        <div>
          <Check />
          <span>
            <strong>
              {learning
                .filter((e) => e.completed)
                .reduce((n, e) => n + duration(e), 0)}{" "}
              min
            </strong>
            completed this week
          </span>
        </div>
        <div className={pairs.length ? "pl-warning" : ""}>
          <AlertTriangle />
          <span>
            <strong>
              {pairs.length} {pairs.length === 1 ? "conflict" : "conflicts"}
            </strong>
            need your attention
          </span>
        </div>
        <div>
          <MessageCircle />
          <span>
            <strong>
              {
                state.events.filter((e) => e.assistance?.status === "pending")
                  .length
              }{" "}
              requests
            </strong>
            waiting for a reply
          </span>
        </div>
      </div>
      {error && (
        <div className="pl-error" role="alert">
          {error}{" "}
          <button onClick={() => window.location.reload()}>Reload plan</button>
        </div>
      )}
      <p className="pl-notice" role="status">
        {notice}
      </p>
      {loading ? (
        <p>Loading your plan…</p>
      ) : (
        <div className="pl-layout">
          <aside className="pl-sidebar pl-panel">
            <p className="pl-kicker">YOUR NEXT STEPS</p>
            <h2>Learning to schedule</h2>
            <p className="pl-muted">
              Bring one resource into your week. You can split it into shorter
              sessions.
            </p>
            {shortlist.length ? (
              shortlist.map((s) => {
                const r = catalogue.find((r) => r.id === s.resourceId);
                if (!r) return null;
                const scheduled = state.events
                  .filter((e) => e.resourceId === r.id)
                  .reduce((n, e) => n + duration(e), 0);
                return (
                  <article className="pl-resource" key={r.id}>
                    <span>{s.skillName}</span>
                    <h3>{r.title}</h3>
                    <p>
                      {r.minutes
                        ? `${r.minutes} min · example duration`
                        : "Confirm duration with provider"}
                    </p>
                    {s.chapterNames?.length ? (
                      <details>
                        <summary>
                          {s.chapterNames.length} selected chapters
                        </summary>
                        <ul>
                          {s.chapterNames.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {s.scheduleMode === "routine" && s.startDate ? <p>Preferred start: {s.startDate}</p> : null}
                    {s.weekdays?.length && s.minutesPerDay ? (
                      <p>
                        {s.weekdays
                          .map(
                            (day) =>
                              ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                                day
                              ],
                          )
                          .join(", ")}{" "}
                        · {s.minutesPerDay} min/day preferred
                      </p>
                    ) : null}
                    {scheduled > 0 && (
                      <p>{scheduled} min scheduled across your plan</p>
                    )}
                    <button
                      disabled={busyOrLoading}
                      onClick={() => newEvent(r.id)}
                    >
                      Schedule a session <Plus size={14} />
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="pl-empty">
                <BookOpen />
                <p>Your selected resources will appear here.</p>
              </div>
            )}
            <Link
              {...({
                className: "pl-link",
                to: `${ROUTES.learningCentre}${demo ? "" : "?demo=0"}`,
              } satisfies Partial<ComponentProps<typeof Link>>)}
            >
              Explore learning resources <ArrowRight size={14} />
            </Link>
            <div className="pl-tip">
              <Clock3 size={19} />
              <h3>Leave a little breathing room</h3>
              <p>
                Keep time for rest and unexpected changes. An empty space does
                not have to be filled.
              </p>
            </div>
          </aside>
          <main className="pl-calendar pl-panel">
            <div className="pl-weekbar">
              <div>
                <p className="pl-kicker">YOUR WEEK AT A GLANCE</p>
                <h2>
                  {readable(week)} – {readable(addDays(week, 6))}
                </h2>
              </div>
              <div className="pl-week-buttons">
                <button
                  aria-label="Previous week"
                  onClick={() => setWeek(addDays(week, -7))}
                >
                  <ChevronLeft size={17} />
                </button>
                <button onClick={() => setWeek(monday(dateKey(new Date())))}>
                  Today
                </button>
                <button
                  aria-label="Next week"
                  onClick={() => setWeek(addDays(week, 7))}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
            <div className="pl-legend">
              {Object.entries(labels).map(([kind, label]) => (
                <span key={kind}>
                  <i className={`pl-dot ${kind}`} />
                  {label}
                </span>
              ))}
            </div>
            <p className="pl-timezone">
              Times in {Intl.DateTimeFormat().resolvedOptions().timeZone} ·
              Select an activity to manage it
            </p>
            {pairs.length > 0 && (
              <div className="pl-conflict-strip">
                <AlertTriangle size={17} />
                <span>
                  {pairs.length} overlapping{" "}
                  {pairs.length === 1 ? "pair" : "pairs"} this week
                </span>
                <button
                  onClick={() =>
                    setSelectedId(
                      (pairs[0].find((e) => e.shareable) || pairs[0][0]).id,
                    )
                  }
                >
                  Review
                </button>
              </div>
            )}
            <div className="pl-days">
              {days.map((day) => (
                <section
                  className={`pl-day ${day === dateKey(new Date()) ? "today" : ""}`}
                  key={day}
                >
                  <header>
                    <span>
                      {new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", {
                        weekday: "short",
                      })}
                    </span>
                    <strong>{new Date(`${day}T12:00:00`).getDate()}</strong>
                  </header>
                  <div className="pl-day-events">
                    {visible
                      .filter((e) => e.date === day)
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((e) => {
                        const conflict = pairs.some((pair) =>
                          pair.some((x) => x.id === e.id),
                        );
                        return (
                          <button
                            className={`pl-event ${e.kind} ${selectedId === e.id ? "selected" : ""} ${e.completed ? "completed" : ""}`}
                            key={e.id}
                            onClick={() => setSelectedId(e.id)}
                          >
                            <span>
                              {e.start}–{e.end}
                            </span>
                            <strong>{e.title}</strong>
                            <small>{labels[e.kind]}</small>
                            {conflict && (
                              <em>
                                <AlertTriangle size={12} /> Overlap
                              </em>
                            )}
                            {e.assistance && (
                              <small>
                                {e.assistance.status === "accepted"
                                  ? `${e.assistance.name} · confirmed`
                                  : e.assistance.status === "pending"
                                    ? "Awaiting reply"
                                    : e.assistance.status === "draft"
                                      ? "Request draft"
                                      : "Help unavailable"}
                              </small>
                            )}
                            {e.completed && <small>✓ Completed</small>}
                          </button>
                        );
                      })}
                    <button
                      className="pl-add-day"
                      aria-label={`Add activity on ${day}`}
                      onClick={() => {
                        setFormError("");
                        setRepeat(false);
                        setEditor({
                          id: crypto.randomUUID(),
                          title: "",
                          kind: "personal",
                          date: day,
                          start: "18:30",
                          end: "19:00",
                          flexible: false,
                          shareable: false,
                          completed: false,
                        });
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </section>
              ))}
            </div>
            <p className="pl-calendar-note">
              Activities are ordered by start time. Card height does not
              represent duration.
            </p>
          </main>
          <aside className="pl-detail pl-panel">
            <p className="pl-kicker">ACTIVITY & SUPPORT</p>
            {selected ? (
              <>
                <div className="pl-detail-heading">
                  <h2>{selected.title}</h2>
                  <button
                    aria-label="Close activity"
                    onClick={() => setSelectedId("")}
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="pl-detail-date">
                  {readable(selected.date)} · {selected.start}–{selected.end}
                </p>
                <div className="pl-tags">
                  <span>{labels[selected.kind]}</span>
                  <span>
                    {selected.flexible ? "Flexible time" : "Fixed time"}
                  </span>
                </div>
                <p className="pl-owner">
                  Responsible:{" "}
                  <strong>
                    {selected.assistance?.status === "accepted"
                      ? selected.assistance.name
                      : "You"}
                  </strong>
                </p>
                {selectedConflicts.length > 0 && (
                  <div className="pl-conflict-box">
                    <AlertTriangle size={18} />
                    <h3>Two things need your time</h3>
                    {selectedConflicts.map((e) => (
                      <p key={e.id}>
                        {e.title} · {e.start}–{e.end}
                      </p>
                    ))}
                    <p>
                      Move a flexible activity or ask someone to help with a
                      shareable responsibility.
                    </p>
                    {selectedConflicts
                      .filter((e) => e.flexible)
                      .map((e) => (
                        <button
                          key={e.id}
                          className="pl-link"
                          onClick={() => setSelectedId(e.id)}
                        >
                          Adjust {e.title} →
                        </button>
                      ))}
                  </div>
                )}
                <div className="pl-detail-actions">
                  <button
                    disabled={busyOrLoading}
                    onClick={() => {
                      setEditor({ ...selected });
                      setRepeat(false);
                      setFormError("");
                    }}
                  >
                    Edit activity
                  </button>
                  {selected.kind === "learning" && (
                    <button
                      disabled={busyOrLoading}
                      onClick={() =>
                        commit(
                          state.events.map((e) =>
                            e.id === selected.id
                              ? { ...e, completed: !e.completed }
                              : e,
                          ),
                        )
                      }
                    >
                      {selected.completed
                        ? "Mark incomplete"
                        : "Mark completed"}
                    </button>
                  )}
                </div>
                {selected.flexible && (
                  <section className="pl-suggestions">
                    <h3>Other available times</h3>
                    <p>
                      Based on your saved activities, between 08:00 and 21:00.
                      Choose a time that suits you.
                    </p>
                    {suggestions(selected, state.events).map((slot) => (
                      <button
                        disabled={busyOrLoading}
                        key={slot.date + slot.start}
                        onClick={async () => {
                          if (
                            await commit(
                              state.events.map((e) =>
                                e.id === selected.id
                                  ? { ...e, ...slot, assistance: undefined }
                                  : e,
                              ),
                            )
                          ) {
                            setWeek(monday(slot.date));
                            setNotice(
                              "Activity moved. Any previous assistance confirmation was cleared.",
                            );
                          }
                        }}
                      >
                        {readable(slot.date)} · {slot.start}–{slot.end}
                        <ArrowRight size={13} />
                      </button>
                    ))}
                    {!suggestions(selected, state.events).length && (
                      <p>
                        No available suggestion in the next seven days. Edit the
                        activity to choose another date.
                      </p>
                    )}
                  </section>
                )}
                {selected.shareable && (
                  <section className="pl-help">
                    <MessageCircle size={21} />
                    <h3>Ask family for a hand</h3>
                    <p>
                      Your family can reply in WhatsApp. They do not need an
                      account here.
                    </p>
                    {!selected.assistance ? (
                      <button
                        className="pl-primary"
                        disabled={busyOrLoading}
                        onClick={openRequest}
                      >
                        Prepare a request
                      </button>
                    ) : (
                      <>
                        <div
                          className={`pl-request-status ${selected.assistance.status}`}
                        >
                          <strong>{selected.assistance.name}</strong>
                          <span>
                            {
                              {
                                draft: "Draft · not sent",
                                pending: "Waiting for a reply",
                                accepted: "Accepted · recorded by you",
                                declined: "Unable to help · recorded by you",
                              }[selected.assistance.status]
                            }
                          </span>
                        </div>
                        <p className="pl-message">
                          {selected.assistance.message}
                        </p>
                        {selected.assistance.status === "draft" && (
                          <>
                            <a
                              className="pl-whatsapp"
                              href={whatsappLink(selected.assistance.message)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open WhatsApp <ArrowRight size={14} />
                            </a>
                            <p>
                              Choose the intended person and send in WhatsApp.
                              Opening it does not send or confirm this request.
                            </p>
                            <button
                              disabled={busyOrLoading}
                              onClick={() => status("pending")}
                            >
                              I sent the request
                            </button>
                            <button
                              disabled={busyOrLoading}
                              onClick={openRequest}
                            >
                              Edit draft
                            </button>
                          </>
                        )}
                        {selected.assistance.status === "pending" && (
                          <>
                            <p>
                              After reading their reply, record the result
                              below. You remain responsible until they accept.
                            </p>
                            <button
                              disabled={busyOrLoading}
                              className="pl-primary"
                              onClick={() => status("accepted")}
                            >
                              They accepted
                            </button>
                            <button
                              disabled={busyOrLoading}
                              onClick={() => status("declined")}
                            >
                              They cannot help
                            </button>
                          </>
                        )}
                        {selected.assistance.status === "declined" && (
                          <button
                            disabled={busyOrLoading}
                            onClick={openRequest}
                          >
                            Prepare another request
                          </button>
                        )}
                        {selected.assistance.status === "accepted" && (
                          <p>
                            Check any handover details with{" "}
                            {selected.assistance.name}. Their calendar is not
                            connected.
                          </p>
                        )}
                        <button
                          onClick={() => copy(selected.assistance!.message)}
                        >
                          <Copy size={13} /> Copy message
                        </button>
                        <button
                          disabled={busyOrLoading}
                          onClick={() =>
                            commit(
                              state.events.map((e) =>
                                e.id === selected.id
                                  ? { ...e, assistance: undefined }
                                  : e,
                              ),
                            )
                          }
                        >
                          Clear request / take responsibility back
                        </button>
                      </>
                    )}
                  </section>
                )}
                <button
                  className="pl-delete"
                  disabled={busyOrLoading}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 size={14} /> Delete activity
                </button>
              </>
            ) : (
              <div className="pl-empty">
                <CalendarDays />
                <h3>A little space to organise</h3>
                <p>
                  Select an activity to edit its time, review a conflict or ask
                  for help.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
      <p className="pl-footer">
        {demo
          ? "Demo data stays in this browser."
          : "Your plan is saved to your account."}{" "}
        WhatsApp delivery and replies are not tracked automatically.
      </p>
      <Dialog {...dialogProps1}>
        <DialogContent className="pl-modal">
          <DialogTitle>
            {state.events.some((e) => e.id === editor?.id)
              ? "Edit activity"
              : "Add an activity"}
          </DialogTitle>
          <DialogDescription>
            Choose a time for learning or everyday life. Overlaps are allowed
            and will be highlighted.
          </DialogDescription>
          {editor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEvent();
              }}
            >
              <label>
                Activity title
                <input
                  required
                  maxLength={160}
                  value={editor.title}
                  onChange={(e) =>
                    setEditor({ ...editor, title: e.target.value })
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={editor.kind}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      kind: e.target.value as PlanEvent["kind"],
                      shareable: false,
                      assistance: undefined,
                      resourceId: undefined,
                    })
                  }
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  required
                  type="date"
                  value={editor.date}
                  onChange={(e) =>
                    setEditor({ ...editor, date: e.target.value })
                  }
                />
              </label>
              <div className="pl-form-row">
                <label>
                  Start
                  <input
                    required
                    type="time"
                    value={editor.start}
                    onChange={(e) =>
                      setEditor({ ...editor, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  End
                  <input
                    required
                    type="time"
                    value={editor.end}
                    onChange={(e) =>
                      setEditor({ ...editor, end: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="pl-check">
                <input
                  type="checkbox"
                  checked={editor.flexible}
                  onChange={(e) =>
                    setEditor({ ...editor, flexible: e.target.checked })
                  }
                />{" "}
                Time can be adjusted
              </label>
              {editor.kind === "care" && (
                <label className="pl-check">
                  <input
                    type="checkbox"
                    checked={editor.shareable}
                    onChange={(e) =>
                      setEditor({ ...editor, shareable: e.target.checked })
                    }
                  />{" "}
                  I can ask someone to share this responsibility
                </label>
              )}
              {!state.events.some((e) => e.id === editor.id) && (
                <label className="pl-check">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(e) => setRepeat(e.target.checked)}
                  />{" "}
                  Repeat weekly for 4 weeks (independent activities)
                </label>
              )}
              {editor.assistance && (
                <p>
                  Changing the title, time or sharing setting clears this
                  request. Tell your helper about any changes.
                </p>
              )}
              {formError && (
                <p role="alert" className="pl-error">
                  {formError}
                </p>
              )}
              <button className="pl-primary" disabled={busy} type="submit">
                {busy ? "Saving…" : "Save activity"}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog {...dialogProps2}>
        <DialogContent className="pl-modal">
          <DialogTitle>Prepare a WhatsApp request</DialogTitle>
          <DialogDescription>
            Only the message below will be shared. Review it before opening
            WhatsApp.
          </DialogDescription>
          <label>
            Who would you like to ask?
            <input
              maxLength={80}
              value={helper}
              onChange={(e) => {
                setHelper(e.target.value);
                if (selected)
                  setMessage(
                    requestMessage(selected, e.target.value || "there"),
                  );
              }}
              placeholder="Family member’s name"
            />
          </label>
          <label>
            Message
            <textarea
              rows={6}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <p>
            You will choose the recipient in WhatsApp. No message is sent from
            this website.
          </p>
          {formError && <p role="alert">{formError}</p>}
          <button className="pl-primary" disabled={busy} onClick={saveRequest}>
            Save request draft
          </button>
        </DialogContent>
      </Dialog>
      <Dialog {...dialogProps3}>
        <DialogContent className="pl-modal">
          <DialogTitle>Delete this activity?</DialogTitle>
          <DialogDescription>
            Only this occurrence will be deleted. If you have asked someone for
            help, let them know separately.
          </DialogDescription>
          <button
            className="pl-primary"
            disabled={busy}
            onClick={async () => {
              if (
                selected &&
                (await commit(state.events.filter((e) => e.id !== selected.id)))
              ) {
                setDeleteOpen(false);
                setSelectedId("");
              }
            }}
          >
            Delete activity
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
