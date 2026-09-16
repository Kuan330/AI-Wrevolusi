# Learning Progress, Check-in & Daily Brief — Frontend Integration Guide

**Audience:** whoever builds the My Plan page components (the AI bot panel and the
check-in calendar).

**Status:** backend complete and tested. The three database tables are **not yet
created** — see [Before you start](#before-you-start).

**Base path:** `/api/v1` (the existing `VITE_API_BASE_URL`). Auth is the existing
cookie session; send `credentials: "include"` exactly as `services/api.ts`
already does.

---

## 0. What this feature is

On the My Plan page, a bot shows one short briefing per day. It greets the
learner, describes their progress and check-in streak, suggests up to two skills
to study today, and reminds them to check in. There is **no chat and no user
input** — the brief is generated automatically.

Two variants exist per day:

| Variant | When | Recommendation rule |
|---|---|---|
| `before_checkin` | Learner has not checked in today | Lowest progress first; ties broken by skill importance |
| `after_checkin` | Learner has checked in today | Same, but **skills already studied today are excluded** |

The brief is **stable within a day**: calling the endpoint again returns the same
text. Checking in switches the variant, which produces a new brief.

---

## 1. Before you start

Two things must happen before the endpoints work end-to-end:

1. **The database tables must be created** (backend duty, needs the database
   owner's approval):
   ```bash
   cd backend && .venv/Scripts/python.exe -m alembic upgrade head
   ```
   Until this runs, every endpoint below returns a 500 because the tables do not
   exist.

2. **The catalogue shape must be supplied by the frontend.** The backend has no
   course or chapter table, so every call that needs progress tells the server
   *how many chapters each selected skill has*. That count comes from
   `pages/LearningCentre/catalogue.ts` + `pages/Skills/learningSkills.ts`
   (`courseLinks`).

   ```ts
   // per selected skill, total chapters = sum of chapters of its mapped courses
   totalChaptersForSkill(skillId) =
     coursesForSkill(skillId)
       .map(id => courses.find(c => c.id === id)?.chapters?.length ?? 0)
       .reduce((sum, n) => sum + n, 0)
   ```

   ⚠️ Known data gaps that affect this number today:
   - `Networks and cybersecurity`, `Resilience, flexibility and agility`,
     `Talent management`, `Environmental stewardship` → **no mapped courses**, so
     `totalChapters` is `0`.
   - `c5 Excel: Foundations`, `c7 Statistics & Probability`,
     `c11 Computers and the Internet` → no chapter list, contributing `0`.

   **Send `0` for these anyway.** The backend then marks the skill
   `is_candidate: false` and simply never recommends it — no frontend
   special-casing needed. Once the data is filled in, the skill starts being
   recommended automatically with no code change on either side.

---

## 2. Date and time rules (read this first)

Every "day" in this API is a **local calendar date string** `YYYY-MM-DD`,
computed by the browser. The server never derives today from a timestamp, because
its clock may be in a different timezone than the learner.

**Build it like this, not with `toISOString()`** (which converts to UTC and can
shift the day):

```ts
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const localHour = (d = new Date()) => d.getHours();   // 0–23, for the greeting
```

**Do not cache "today" for the lifetime of the page.** If the learner leaves the
page open past midnight, recompute it. The existing pattern of listening to
`window` `focus` / `storage` events is enough:

```ts
useEffect(() => {
  const refresh = () => setToday(localDate());
  window.addEventListener("focus", refresh);
  return () => window.removeEventListener("focus", refresh);
}, []);
```

Sending yesterday's date after midnight is rejected by the server as "too far in
the past" only after ~400 days, so a stale tab would silently write to the wrong
day — hence the refresh above matters.

The server rejects any date more than one day in the future, and any date older
than 400 days, with **422**.

---

## 3. Endpoints

### 3.1 `POST /learning/progress` — record chapter values

Call this whenever the learner moves a chapter's 0–10 value.

**Request**

```jsonc
{
  "local_date": "2026-09-16",
  "chapters": [
    { "skill_id": "ai-and-big-data", "course_id": "c2", "chapter_index": 0, "value": 5 }
  ]
}
```

- `chapter_index` is the **0-based index** into the course's `chapters` array.
- `value` is the **cumulative** value (0–10), not the increment. A chapter stored
  at 5 stays at 5 tomorrow; moving it to 8 sends `8`.
- Batch as many chapters as you like (max 200) — send the whole changed set in
  one call.

**Response 200**

```jsonc
{
  "accepted": 1,
  "updated": [ { "skill_id": "ai-and-big-data", "course_id": "c2", "chapter_index": 0, "value": 5 } ],
  "rejected": []
}
```

**Rejection reasons** (`rejected[].reason`):

| reason | meaning | what to show |
|---|---|---|
| `not_increase` | value is lower than what is stored | the value cannot go down; `stored_value` tells you the actual stored one |
| `unknown_scope` | reserved for future use | – |
| `invalid_value` | reserved for future use | – |

**Behaviour worth knowing:**

- **Values only move forward.** A lower value is refused, not silently clamped.
- **Re-sending the same value is not an error.** `accepted` counts it and nothing
  is written — in particular the chapter does **not** become "studied today"
  because of a retry. So a double tap is safe.
- Other learners' records are unreachable: the user id always comes from the auth
  cookie, never from the body.

---

### 3.2 `POST /learning/checkin` — check in for today

**Request**

```json
{ "local_date": "2026-09-16" }
```

**Response 200**

```jsonc
{ "checked_on": "2026-09-16", "created": true, "streak_days": 4 }
```

- `created: false` means the day was already checked in — treat it as success, not
  an error.
- **A check-in requires that something was studied that day.** Otherwise:

**Response 409**

```json
{ "detail": "There is no learning recorded for this day yet, so it cannot be checked in." }
```

Show that message and tell the learner to log a chapter value first. This gate
exists so the calendar and streak cannot be filled without learning behind them.

---

### 3.3 `GET /learning/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` — the calendar

**Response 200**

```jsonc
{
  "from_date": "2026-09-10",
  "to_date": "2026-09-16",
  "days": [
    { "day": "2026-09-10", "checked_in": false, "studied": false, "chapters_touched": 0 },
    { "day": "2026-09-15", "checked_in": false, "studied": true,  "chapters_touched": 2 },
    { "day": "2026-09-16", "checked_in": true,  "studied": true,  "chapters_touched": 1 }
  ],
  "streak_days": 4,
  "total_checked_in": 12
}
```

**Three states per day** — use them to light the calendar:

| `checked_in` | `studied` | meaning | suggested look |
|---|---|---|---|
| `true` | any | checked in | **fully lit** |
| `false` | `true` | studied but has not checked in | **half lit** (nudges them to check in) |
| `false` | `false` | nothing happened | empty |

If your design only wants two states, light the day when `checked_in` is true.

**Range limits:** `to` must not be before `from`, and the span must be ≤ 366 days
(both otherwise **422**). A year query is a good single call for a month grid.

---

### 3.4 `POST /learning/summary` — per-skill progress

Use this for any "your skills" overview. Not required by the bot itself.

**Request**

```jsonc
{
  "local_date": "2026-09-16",
  "skills": [
    { "skill_id": "ai-and-big-data", "total_chapters": 26, "skill_name": "AI and big data" },
    { "skill_id": "talent-management", "total_chapters": 0,  "skill_name": "Talent management" }
  ]
}
```

**Response 200**

```jsonc
{
  "local_date": "2026-09-16",
  "streak_days": 4,
  "checked_in_today": true,
  "selected_skill_count": 2,
  "skills": [
    {
      "skill_id": "ai-and-big-data",
      "total_chapters": 26,
      "target_value": 260,
      "earned_value": 65,
      "progress": 0.25,
      "last_studied_on": "2026-09-16",
      "studied_today": true,
      "is_candidate": true
    },
    {
      "skill_id": "talent-management",
      "total_chapters": 0, "target_value": 0, "earned_value": 0,
      "progress": 0, "last_studied_on": null, "studied_today": false,
      "is_candidate": false
    }
  ]
}
```

- `progress` is `0–1`; render it as a percentage (`Math.round(progress * 100)`).
- **`is_candidate: false`** means the skill has no chapter data and **will never be
  recommended**. If you show a reason anywhere, say it is not part of the course
  catalogue yet.

---

### 3.5 `POST /learning/daily-brief` — the bot's briefing

**This is the endpoint the bot panel needs.**

**Request**

```jsonc
{
  "local_date": "2026-09-16",
  "local_hour": 9,
  "display_name": "Ella",
  "skills": [
    { "skill_id": "ai-and-big-data", "total_chapters": 26, "skill_name": "AI and big data", "importance_pct": 55 },
    { "skill_id": "creative-thinking", "total_chapters": 10, "skill_name": "Creative thinking",  "importance_pct": 42 },
    { "skill_id": "technological-literacy", "total_chapters": 4, "skill_name": "Technological literacy", "importance_pct": 40 }
  ]
}
```

- `local_hour` (0–23) decides the greeting server-side.
- `display_name` is optional; omit it and the greeting has no name.
- `importance_pct` is optional. Supply the WEF importance for the skill so the
  server can break progress ties. Skills without it still work.
- A skill with `total_chapters: 0` is accepted and simply never recommended.

**Response 200**

```jsonc
{
  "local_date": "2026-09-16",
  "variant": "before_checkin",
  "checked_in_today": false,
  "streak_days": 4,
  "greeting": "Good morning, Ella.",
  "summary": "You are making steady progress and your streak is holding.",
  "recommendations": [
    { "skill_id": "technological-literacy", "skill_name": "Technological literacy",
      "reason": "This is your widest gap right now.", "progress": 0.1, "importance_pct": 40 }
  ],
  "closing": "When you finish today's learning, remember to check in.",
  "generated_by_model": true,
  "generated_at": "2026-09-16T01:05:12.331Z",
  "cached": false
}
```

**Field notes for the UI:**

| Field | Note |
|---|---|
| `greeting` | Ready to render. **Do not re-derive it from the browser clock** — the server already used `local_hour`. |
| `summary` / `closing` | Model-written prose. Contains **no numbers by design**. |
| `recommendations` | 0–2 entries. **0 is normal** when the learner has ≤ 2 selected skills, or when every usable skill was already studied today. |
| `recommendations[].progress` | The number to display (`0–1`). This is where the numbers live, not in the prose. |
| `generated_by_model` | `false` means the wording is the built-in template because the language model was unavailable. Still perfectly good text — no error handling needed. |
| `cached` | `true` on repeat visits in the same day and state. |

**What may and may not happen to the text:**

- The model **cannot** change which skills are recommended. If it names a skill
  the server did not choose, or invents a number, or produces a discouraging or
  predictive sentence, the whole response silently falls back to the template.
  So you will never render a recommendation the tool did not decide on.
- The text is **English**, warm and non-pressuring.

**Rendering the panel:**

- Show `greeting`, then `summary`, then each recommendation's `skill_name` +
  `reason` + `progress` as a percentage, then `closing`.
- Show a loading state — the **first** generation of a day can take 5–30 s on the
  free model. Every later call that day is instant (`cached: true`).
- If the call fails (network/timeout), **hide the panel** rather than showing an
  error, matching how the other AI blocks on the page behave. The next visit
  retries.

---

## 4. Suggested frontend flow

```
On My Plan mount:
  1. today = localDate(), hour = localHour()
  2. skills = selectedSkills.map(s => ({
       skill_id: s.id, skill_name: s.name,
       total_chapters: totalChaptersForSkill(s.id),
       importance_pct: wefImportanceFor(s.name),      // optional
     }))
  3. POST /learning/daily-brief   → render the bot panel
  4. GET  /learning/calendar?from=<month start>&to=<month end>  → render the calendar

When the learner moves a chapter value:
  POST /learning/progress  → then refresh the calendar (and the bot, since
                             "studied today" may have changed the variant)

When the learner taps "check in":
  POST /learning/checkin
    → 200: refresh the calendar and POST /learning/daily-brief again
           (the variant has switched, so a new brief is generated)
    → 409: show the detail message and prompt them to log progress first
```

**Note on step 3 + 4 together:** the bot call is the slow one on first load.
Fetching the calendar in parallel keeps the page responsive.

---

## 5. TypeScript types

Drop these next to your service wrapper (mirrors `services/aiService.ts` in shape).

```ts
export type SkillShape = {
  skill_id: string;
  skill_name?: string;
  total_chapters: number;
  importance_pct?: number | null;
};

export type ChapterProgress = {
  skill_id: string;
  course_id: string;
  chapter_index: number;
  value: number;
};

export type ProgressUpdateResponse = {
  accepted: number;
  updated: ChapterProgress[];
  rejected: {
    course_id: string;
    chapter_index: number;
    reason: "not_increase" | "unknown_scope" | "invalid_value";
    stored_value?: number | null;
  }[];
};

export type CheckinResponse = {
  checked_on: string;
  created: boolean;
  streak_days: number;
};

export type CalendarDay = {
  day: string;
  checked_in: boolean;
  studied: boolean;
  chapters_touched: number;
};

export type CalendarResponse = {
  from_date: string;
  to_date: string;
  days: CalendarDay[];
  streak_days: number;
  total_checked_in: number;
};

export type SkillSummary = {
  skill_id: string;
  total_chapters: number;
  target_value: number;
  earned_value: number;
  progress: number;
  last_studied_on: string | null;
  studied_today: boolean;
  is_candidate: boolean;
};

export type SummaryResponse = {
  local_date: string;
  streak_days: number;
  checked_in_today: boolean;
  skills: SkillSummary[];
  selected_skill_count: number;
};

export type Recommendation = {
  skill_id: string;
  skill_name: string;
  reason: string;
  progress: number;
  importance_pct?: number | null;
};

export type DailyBriefResponse = {
  local_date: string;
  variant: "before_checkin" | "after_checkin";
  checked_in_today: boolean;
  streak_days: number;
  greeting: string;
  summary: string;
  recommendations: Recommendation[];
  closing: string;
  generated_by_model: boolean;
  generated_at: string;
  cached: boolean;
};
```

**Timeouts:** the existing `api.post` takes a timeout argument. The brief needs a
generous one (**60 s** is safe) because first generation can be slow; everything
else is fast and can keep the default.

---

## 6. Errors at a glance

| Status | Where | Meaning / handling |
|---|---|---|
| `401` | all | Not signed in. Existing refresh handling applies. |
| `409` | `/checkin` | Nothing studied yet today. Show `detail`; ask them to log progress first. |
| `422` | all | Bad input: date in the future / far past, calendar range backwards or > 1 year, value outside 0–10, empty `skills`. Fix the request. |
| `500` | all | Almost certainly the tables have not been created yet. See §1. |

---

## 7. Scope note for the brief's wording

The brief is user-facing encouragement, so the backend enforces:

- No numbers in the prose (the UI owns the numbers).
- No prediction of job loss, replacement, unemployment or hiring outcomes.
- No judgement of the learner, and no pressure wording.
- Only the skills the server selected may be mentioned.
- The interface always shows a "verify/your own judgement" style caveat where
  AI-written text appears, consistent with the rest of the product.

---

## 8. Files the backend added (for reference)

| Path | Contents |
|---|---|
| `backend/app/models/learning.py` | 3 tables: `learning_progress`, `learning_checkins`, `daily_briefs` |
| `backend/app/schemas/learning.py` | request/response contracts |
| `backend/app/schemas/brief_text.py` | the prose-only model the LLM must satisfy |
| `backend/app/services/learning.py` | pure rules: progress, streak, ranking, value merge |
| `backend/app/services/learning_records.py` | database access |
| `backend/app/services/daily_brief.py` | brief assembly, prompt, sanitiser, template fallback |
| `backend/app/routers/learning.py` | the 5 endpoints above |
| `backend/alembic/versions/0001_add_learning_tables.py` | the migration (not yet applied) |
| `backend/tests/test_learning_rules.py` | 24 tests on the pure rules |
| `backend/tests/test_daily_brief_text.py` | 17 tests on the LLM constraints |
| `backend/tests/test_learning_endpoints.py` | 15 tests on the HTTP contract |
