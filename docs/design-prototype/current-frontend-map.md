> **Latest status:** Work stopped at the user-accepted checkpoint. See [checkpoint-handoff.md](checkpoint-handoff.md) for current counts, unfinished items and verification limits; earlier progress notes below are historical.

# Current frontend and Figma continuation

The screenshots in [frontend-captures](frontend-captures/) and the expanded [81-screen capture manifest](screen-assets/manifest.json) are the visual baseline for the Figma copy. The earlier local HTML prototype is a simplified concept and must not replace this baseline.

## Snapshot and evidence

- Date: 15 September 2026.
- Branch: `kuan/design-prototype`.
- Commit: `5e0e196da400b89f6ac9b4e8542b970d1ba7deee`.
- Capture setup: actual current frontend build, with an isolated local fixture API using repository CSV data. No live account or database was used.
- Source inspection used targeted current-source reads because codebase-memory was unavailable.
- This record covers rendered frontend behavior and source inspection. It does not verify backend behavior, production data, provider availability or cross-device saving.

## Current Figma access

Fresh `whoami` succeeded for the intended personal account:

| Field | Current result |
| --- | --- |
| Email | `leekuanloong17@gmail.com` |
| Team | `Kuan_'s team` |
| Seat | View |
| Plan | Starter |

A fresh `use_figma` call remains blocked by the Starter tool-call quota. The earlier “Unknown tool” result does not describe the current `whoami` connection. The user signed in to the regular Figma editor, where the continuation verified all three original pages, preserved earlier work and imported 81 current screen assets as native frames.

Native linking is in progress: [the link registry](native-prototype-links.json) contained 40 interactions at this documentation snapshot, with the final count pending. There are 81 locally generated wireframes and seven proposal assets; wireframe boards and proposals await native import at this snapshot. Screenshot comparison is under way. The full desktop and mobile journey has not yet been verified in Figma Present mode.

Continue in the [existing Figma file](https://www.figma.com/design/v7f5dr4CBH1KDNA7fOxctD), preserving its current pages and nodes. Use [figma-state.json](figma-state.json) for historical IDs and [the native registry](native-figma-imports.json) for current frame IDs. No tracked application edits, upgrade, billing change, deployment or commit are part of this work. Application integration remains pending visual approval.

## Current screen map

| Route or state | Current layout and behavior | Capture reference |
| --- | --- | --- |
| `/` | Landing page and free work-analysis entry. Signed-in users normally redirect to AI Exposure. | `01-home-*` |
| `/profile` | Narrow centered occupation form; category browsing and job-title search are alternate modes. A selected occupation leads to Tasks. | `02-occupation-*`, `03-occupation-selected-desktop` |
| `/profile/tasks` | Task list with add, edit and delete actions. Task editor shows wording, standard-task check, task frequency and notes. | `04-tasks-*`, `05-task-editor-mobile` |
| `/learning-centre` as guest | Account introduction with Log in / Create account. Learning and planning are account-gated. | `06-learning-account-gate-*` |
| `/ai-exposure` | Score overview, score-range slider, task list and selected-task guidance. Edit tasks and View skills remain available. | `07-ai-exposure-*` |
| `/skills` | Skill map, supporting task evidence, detail workspace and learning-skill selection. Confirm and find courses continues to resources. | `08-skills-*` |
| Mobile navigation | Hamburger opens a Navigation dialog with route links. | `09-navigation-mobile` |
| `/learning-centre` with learning skills | Intro panel, skill sidebar, learning-focus summary, search/filters, course cards and saved-course control. | `10-learning-resources-*` |
| Learning focus | Foundation selection, related work experience, manual goal and optional AI goal suggestion requiring explicit acceptance. | `11-learning-focus-*` |
| Course detail | Right drawer with Overview and Chapters tabs, provider link, Save and Plan learning. | `12-course-detail-*`, `13-course-chapters-desktop` |
| Prepare learning | Same drawer: Choose content, then Arrange time. Entire course or available chapters; Schedule later or weekly routine. | `14-choose-content-desktop`, `15-arrange-time-*`, `16-weekly-routine-*` |
| Routine validation | Missing routine details keep preparation open and show a correction message. | `17-routine-validation-mobile` |
| `/plan` | Course progress, weekly time-grid calendar, saved-course sidebar and session/activity details. | `18-plan-*`, `19-learning-session-mobile`, `20-session-completed-mobile` |
| Add activity | Everyday activity form with time and arrangement controls. | `21-add-activity-mobile` |
| Set work hours | Weekdays, daily time range, start date and end date. The form was inspected without saving work events. | `22-work-hours-desktop` |

Capture names above omit `.jpg`. The [capture manifest](frontend-captures/manifest.json) records the available files and CSS viewport sizes. The capture tool can return a smaller raster than the CSS viewport; use the recorded viewport when reproducing the responsive layout.

The expanded [screen-asset manifest](screen-assets/manifest.json) also includes unplanned `resources-start`, `course-start`, `content-start`, `arrange-start` and `routine-start` states; `plan-empty` and `plan-completed`; and the conflict, request, waiting, accepted, declined and resolved examples. These separate captures prevent a scheduled course from appearing to import again, or a completed session from returning to the wrong count. Their native links and visual comparison are still being checked.

## Responsive rules to preserve

- Use the actual screenshot colors, typography, spacing, navigation and component shapes. Do not copy the HTML concept's simplified arrangement.
- Header: sticky, translucent, 64px high. Desktop navigation appears at 1024px and wider; smaller screens use the Navigation dialog.
- Profile and Tasks: centered content up to 672px wide. Tasks uses a fixed-height page with an inner scrolling workspace.
- Exposure and Skills: content up to 1180px wide; desktop workspaces stack below 1024px. Skill choices can scroll horizontally.
- Learning Resources: sidebar and results above 900px, with separate internal scrolling. Below 900px they stack; skill choices change from two columns to one below 540px. Search controls wrap below 700px.
- Course drawer: the settled desktop capture measured **760px wide at a 1440px viewport**. Use this observed width rather than the shared drawer's 576px default. Mobile uses the full screen width.
- Plan: up to 1180px wide; calendar plus a 300px saved-course sidebar above 1000px. The sidebar stacks below the calendar on smaller screens.
- Mobile Plan retains a seven-day time grid with a 700px minimum width inside a scrolling area. It does not become a day list. The calendar uses 42px per hour and initially scrolls to 08:00; selecting a session brings its time into view.
- Preserve the observed mobile baseline issues in the current-screen copy: the Tasks top action is clipped and the Skills heading is squeezed. Put repairs in the proposed design section.

## Journey checked in the rendered frontend

The following actions were clicked using the isolated fixture setup:

1. Guest Home → occupation search → selected occupation → Tasks.
2. Signed fixture AI Exposure → Skills → Confirm and find courses.
3. Learning focus → Pandas course → Save → Chapters → Entire course.
4. Arrange time → weekly routine → My Plan, producing eight 30-minute sessions.
5. Open a learning session → mark complete → undo completion.

Guest task assessment and the signed fixture analysis were separate capture stages. This is not a claim that a live analysis request connected those stages. The native Figma journey is being linked; full Present-mode journey testing remains pending.

## Existing, proposed and future

### Existing frontend

Source contains saved-course export/removal, unknown course-detail labels, manual goals, optional AI goal suggestions, chapter choices, Schedule later, routine preparation and duplicate-schedule rejection. Planner source contains work hours, occurrence edits/deletes, conflict suggestions, WhatsApp handoff, manually recorded assistance outcomes, and completion/undo. Only the journey and states listed above have been checked through the current capture session.

Current course practice advice is a template based on saved context. Its wording identifies it as template guidance and says that it does not assess ability. The observed task editor does **not** expose responsibility, routine processing, information use, human interaction or judgement fields, although related fields exist in source types.

### Proposed Iteration 2 changes

- Versioned recommendation-basis generation with structured task/goal review and confirmation.
- Course-specific generated advice with course/chapter references, generating/failed/outdated states, and updates tied to basis/course versions.
- Any added task-context controls beyond the observed editor.
- Any change from the current exposure score slider to categorical filtering.
- Clearer mobile Tasks actions, readable Skills headings, or a redesigned mobile calendar.
- Any stronger promise that progress is immediately saved to the server. Current planner state uses account workspace storage with separate background synchronization.

Demonstrate a 30-minute routine while retaining the open question about whether the requirement means exactly or at least 30 minutes. Current source accepts other valid time ranges. Missing provider facts remain unknown; personal study estimates stay separate.

### Future concepts

Keep E7 career exploration, E8 AI updates and E9 language/care-mode support on a separate future-concepts page. The application already has a Possibilities route, but that does not establish an agreed E7 delivery commitment. Preserve its existing behavior separately if it is captured later. The concept prototype's updates and care-mode controls are not current application behavior.

## Figma continuation checklist

- [x] Recheck `whoami` and one bounded access call; confirm the personal account and current MCP quota block.
- [x] Verify all three original Figma pages and preserve existing work.
- [x] Import 81 captured current screen assets as native Figma frames and record their IDs.
- [ ] Create clearly named areas for **Current frontend**, **Proposed Iteration 2**, and **Future concepts**.
- [ ] Recreate desktop and mobile frames from the captures, including settled drawers, inner scroll areas and the mobile Navigation dialog.
- [ ] Build editable text, components and layouts; use screenshots as comparison references rather than the finished design.
- [x] Generate 81 wireframes from the same current-screen captures and seven clearly separated proposal assets locally.
- [ ] Import the wireframe boards and proposal assets into their native Figma sections.
- [ ] Connect Home → occupation → Tasks → AI Exposure → Skills → Resources → course → preparation → Plan, with the current account transition represented honestly.
- [ ] Connect course tabs, save/remove, preparation validation, back/close, session completion and undo.
- [ ] Finish linking the captured saved-list, conflict and help-outcome states. Record any remaining activity-edit/delete, partial-import, save-failure and status-preserving return gaps explicitly.
- [ ] Compare each Figma frame against its matching screenshot at the same viewport. Record any intentional difference under Proposed Iteration 2.
- [ ] Click the full Figma journey at desktop and mobile sizes; check destinations, overlays, scrolling and recovery paths.
- [ ] Request visual approval before application integration. Update the state file and review notes with the actual completed scope.
