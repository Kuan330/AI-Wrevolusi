export function exposureFromScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "insufficient_data";
  }
  const n = Number(score);
  if (n >= 0.5) return "partly_automated";
  if (n >= 0.38) return "ai_assisted";
  if (n >= 0.25) return "reshaped";
  return "human_led";
}

export function mapIloRows(rows) {
  return rows.map((r) => ({
    id: "ilo-" + r.task_id,
    ilo_isco_08: r.isco_08,
    ilo_task_id: String(r.task_id),
    name: r.task_text,
    score_2025: r.score_2025,
    potential25: r.potential25,
    mean_score_2025: r.mean_score_2025,
    status: "suggested",
    input_method: "typed",
    time: "",
    responsibility: "",
    is_user_added: false,
  }));
}

export function isScoredIloTask(task) {
  return Boolean(task?.ilo_task_id) && task.status !== "edited" && task.score_2025 != null && task.score_2025 !== "";
}

export function withDisplayNos(tasks) {
  return tasks.map((t, i) => ({
    ...t,
    display_no: `T${String(i + 1).padStart(2, "0")}`,
  }));
}

export function formatScore(value, digits = 2) {
  if (value === null || value === undefined || value === "" || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

export function scorePct(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n * 100));
}

export function yourMix(tasks) {
  const scored = tasks.filter(isScoredIloTask);
  const unscored = tasks.length - scored.length;
  if (!scored.length) {
    return { mean: null, scored: 0, unscored };
  }
  const mean = scored.reduce((sum, t) => sum + Number(t.score_2025), 0) / scored.length;
  return { mean, scored: scored.length, unscored };
}

export function sortTasksForTable(tasks) {
  const scored = tasks.filter(isScoredIloTask).slice().sort((a, b) => Number(b.score_2025) - Number(a.score_2025));
  const rest = tasks.filter((t) => !isScoredIloTask(t));
  return [...scored, ...rest];
}

/** ILO 2025 occupation-scale labels. min/max/median are occupation mean_score_2025 in the source file. */
export const ILO_SCALE_CATEGORIES = [
  { id: "not_exposed", label: "Not Exposed", median: 0.18, min: 0.09, max: 0.36 },
  { id: "minimal", label: "Minimal Exposure", median: 0.35, min: 0.22, max: 0.45 },
  { id: "g1", label: "Exposed: Gradient 1", median: 0.38, min: 0.28, max: 0.39 },
  { id: "g2", label: "Exposed: Gradient 2", median: 0.45, min: 0.4, max: 0.49 },
  { id: "g3", label: "Exposed: Gradient 3", median: 0.55, min: 0.5, max: 0.59 },
  { id: "g4", label: "Exposed: Gradient 4", median: 0.62, min: 0.6, max: 0.7 },
];

export const NOT_SCORED_CATEGORY = { id: "not_scored", label: "Not scored", median: null };

export function iloScaleCategoryByLabel(label) {
  return ILO_SCALE_CATEGORIES.find((c) => c.label === label) || null;
}

export function nearestIloScaleCategory(score, preferLabel) {
  const n = Number(score);
  if (Number.isNaN(n)) return null;
  const contained = ILO_SCALE_CATEGORIES.filter((c) => n >= c.min && n <= c.max);
  const pool = contained.length ? contained : ILO_SCALE_CATEGORIES;
  let best = pool[0];
  let bestDist = Math.abs(n - best.median);
  for (const c of pool.slice(1)) {
    const dist = Math.abs(n - c.median);
    if (dist < bestDist - 1e-9) {
      best = c;
      bestDist = dist;
      continue;
    }
    if (Math.abs(dist - bestDist) <= 1e-9 && preferLabel && c.label === preferLabel) {
      best = c;
    }
  }
  return best;
}

export function groupTasksByIloScale(tasks, preferLabel) {
  const groups = Object.fromEntries(ILO_SCALE_CATEGORIES.map((c) => [c.id, []]));
  groups.not_scored = [];
  tasks.forEach((t) => {
    if (!isScoredIloTask(t)) {
      groups.not_scored.push(t);
      return;
    }
    const cat = nearestIloScaleCategory(t.score_2025, preferLabel);
    groups[cat.id].push(t);
  });
  Object.keys(groups).forEach((id) => {
    groups[id].sort((a, b) => {
      const as = isScoredIloTask(a) ? Number(a.score_2025) : -1;
      const bs = isScoredIloTask(b) ? Number(b.score_2025) : -1;
      return bs - as;
    });
  });
  return groups;
}

export function truncateTitle(name, max = 64) {
  const text = String(name || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function buildChanges(tasks, previous = {}) {
  const next = {};
  tasks.forEach((t) => {
    const linked = Boolean(t.ilo_task_id) && t.status !== "edited";
    const suggested = linked ? exposureFromScore(t.score_2025) : "insufficient_data";
    const prev = previous[t.id];
    next[t.id] = {
      suggested_state: prev?.suggested_state || suggested,
      match_layer: linked ? "exact" : "insufficient_data",
      why:
        prev?.why ||
        (linked
          ? `ILO 2025 score ${t.score_2025 ?? "—"} (${t.potential25 || "no band"}). Occupation mean ${t.mean_score_2025 ?? "—"}.`
          : t.ilo_task_id
            ? "Wording no longer matches the ILO row. NLP matching is not wired yet."
            : "User-added task. NLP/LLM matching is not wired yet."),
    };
  });
  return next;
}

export function seedCaps(wefCatalog) {
  const picks = [
    { name: "Leadership and social influence", interpretation: "continue_useful" },
    { name: "Service orientation and customer service", interpretation: "need_updating" },
    { name: "Talent management", interpretation: "need_strengthening" },
  ];
  const byName = Object.fromEntries(wefCatalog.map((s) => [s.core_skill, s]));
  return picks.map((p, i) => {
    const hit = byName[p.name];
    return {
      id: "cap" + i,
      wef_skill_id: hit?.wef_skill_id || null,
      name: p.name,
      interpretation: p.interpretation,
      why: "Placeholder until NLP matches tasks to WEF 26. You can edit or remove this.",
      is_user_added: false,
    };
  });
}
