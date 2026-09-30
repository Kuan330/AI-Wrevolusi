import { useState } from "react";
import type { GoalHistory } from "@/features/learning-goals/learningGoals";

/** Render one earlier version on demand, rather than every repeated note at once. */
export default function SavedGoalHistory({ history }: { history: GoalHistory[] }) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(10);
  const [active, setActive] = useState<number | null>(null);
  if (!history.length) return null;
  return <details className="lg-starting" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Earlier saved versions ({history.length})</summary>
    {open && <><p>These versions preserve corrections. They are not counted as current attempts.</p>
      {[...history].reverse().slice(0, limit).map(h => <details className="lg-history" key={h.revision} open={active === h.revision} onToggle={event => {
        if (event.currentTarget.open) setActive(h.revision);
        else setActive(value => value === h.revision ? null : value);
      }}><summary>Version {h.revision} · {new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(h.recordedAt))}</summary>
        {active === h.revision && <><p>{h.wording}</p><p>Action: {h.action?.text ?? "None"}{h.action?.origin === "ai_suggestion" ? " · AI suggestion accepted by you" : h.action?.origin === "template" ? " · General starting idea accepted by you" : ""}</p>{h.attempts.map(a => <p key={a.id}>{a.date} · {a.type === "study" ? "Study" : a.type === "course_practice" ? "Course or sample practice" : "Workplace practice"}: {a.description}{a.task ? ` · Task: ${a.task.wording}` : ""}{a.notes ? ` · Notes: ${a.notes}` : ""}</p>)}</>}
      </details>)}
      {history.length > limit && <button type="button" onClick={() => setLimit(value => value + 10)}>Show older versions</button>}
    </>}
  </details>;
}
