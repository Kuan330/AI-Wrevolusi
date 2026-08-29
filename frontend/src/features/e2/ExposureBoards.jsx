import { useEffect, useMemo, useState } from "react";
import {
  ILO_SCALE_CATEGORIES,
  NOT_SCORED_CATEGORY,
  formatScore,
  groupTasksByIloScale,
  iloScaleCategoryByLabel,
  isScoredIloTask,
  truncateTitle,
} from "../../domain/profile";

function BoardCard({ category, tasks, occupationLabel, open, onToggle, onOpenTask }) {
  const isOccupation = occupationLabel && category.label === occupationLabel;
  const count = tasks.length;
  const empty = count === 0;

  return (
    <article className={["scale-card", open ? "open" : "", empty ? "empty" : "", isOccupation ? "is-occupation" : ""].filter(Boolean).join(" ")}>
      <button type="button" className="scale-card-head" onClick={() => !empty && onToggle(category.id)} disabled={empty} aria-expanded={open}>
        <span className="scale-card-label">{category.label}</span>
        {isOccupation ? <span className="badge b-pink">This occupation</span> : null}
        <span className="scale-card-count">
          {count} {count === 1 ? "task" : "tasks"}
        </span>
      </button>
      {open && !empty ? (
        <ul className="scale-card-list">
          {tasks.map((t) => (
            <li key={t.id}>
              <button type="button" className="scale-task" onClick={() => onOpenTask(t)}>
                <span className="task-no">{t.display_no || "—"}</span>
                <span className="scale-task-copy">
                  <span className="scale-task-name">{truncateTitle(t.name, 48)}</span>
                  <strong>{isScoredIloTask(t) ? formatScore(t.score_2025, 3) : "—"}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function ExposureBoards({ tasks, occupationLabel, onOpenTask }) {
  const groups = useMemo(() => groupTasksByIloScale(tasks, occupationLabel), [tasks, occupationLabel]);
  const boards = useMemo(() => {
    const cats = [...ILO_SCALE_CATEGORIES];
    if (groups.not_scored.length) cats.push(NOT_SCORED_CATEGORY);
    return cats;
  }, [groups.not_scored.length]);

  const defaultOpen = useMemo(() => {
    const official = iloScaleCategoryByLabel(occupationLabel);
    if (official && groups[official.id]?.length) return official.id;
    const first = boards.find((c) => groups[c.id]?.length);
    return first?.id || null;
  }, [occupationLabel, groups, boards]);

  const [openId, setOpenId] = useState(defaultOpen);

  useEffect(() => {
    setOpenId(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="exposure-boards" role="list">
      {boards.map((category) => (
        <BoardCard
          key={category.id}
          category={category}
          tasks={groups[category.id] || []}
          occupationLabel={occupationLabel}
          open={openId === category.id}
          onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}
