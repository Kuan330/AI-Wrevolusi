> **Latest status:** Work stopped at the user-accepted checkpoint. See [checkpoint-handoff.md](checkpoint-handoff.md) for current counts, unfinished items and verification limits; earlier progress notes below are historical.

# Requirements and review

## Continuation status — 15 September 2026

The earlier local prototype and its wireframe toggle are a simplified concept, not a faithful frontend copy. Use the [current frontend screenshots](frontend-captures/index.html) and [current frontend map](current-frontend-map.md) as the visual baseline. Preserve existing behaviour separately from proposed Iteration 2 changes and future concepts.

The intended personal Figma account is connected. A fresh editor-tool call confirmed the Starter MCP quota block. No Figma changes were made in this continuation. Faithful editable Figma screens, derived wireframes, clickable Figma journeys and screenshot comparisons remain pending; no visual approval or application integration is implied.

## Source and scope

The user's pasted Iteration 2 text is the requirement source for this prototype:

`/Users/kuan_/.codex/attachments/dc527dbc-24c6-4888-b861-07a16f21d4a2/pasted-text.txt`

This document summarises that source; it does not replace its acceptance criteria. The current checkout supplies the existing interface and behaviour reference. Older project recommendations must not override the new pasted requirements.

The IMF and Media Selangor claims in the pasted text are supplied research, not independently verified claims from this design task. If shown in the prototype, attribute them to the supplied sources. Do not present an example AI score as a measured result or exposure as certainty of job loss.

The selected scope is E1–E6, with greater detail for Iteration 2's E5 and E6. E7–E9 are future concepts. A Figma prototype can show states and transitions; that alone does not verify real storage, scheduling algorithms, provider facts, AI outputs or message delivery.

## Persona and design purpose

Verlyss is a 38-year-old sales supervisor in Subang Jaya, married with two children. She uses spreadsheets, office software and WhatsApp. She has basic digital confidence and limited experience using AI or checking its outputs.

Her work includes customer relationships, coordinating a team, updating sales records, preparing reports and drafting customer messages. She wants to build on this experience, keep stable employment and learn around work, childcare and household commitments.

Her main question is: “What is one useful next step I can take with the time I have?”

The design should use plain language, recognise existing experience, keep choices manageable, allow corrections, and make it easy to return later. It should distinguish user-confirmed information, AI guidance and provider facts.

## Journey and screen traceability

The following map defines required design coverage. Each row needs a visible screen, overlay or documented state; it is not a claim of completed Figma coverage.

| Screen or state | Required content and action | Source stories |
| --- | --- | --- |
| Home | Start free work analysis without creating an account or uploading a CV | US1.1 |
| Match my work | Browse MASCO categories or search a job title; select an occupation; change it when the tasks do not fit | US1.2 |
| My tasks | Review, edit, add, remove one or several representative tasks | US1.3 |
| Optional task context | Frequency, responsibility, routine processing, information use, interaction and judgement; Skip remains valid | US1.4 |
| Start assessment | Continue with meaningful tasks; explain an empty task list or unclear descriptions | US2.1 |
| AI impact results | Occupation, exposure level and score; task categories, counts and category filters; task category and score | US2.2 |
| Skills map | Skills linked to confirmed tasks, future-use trends and AI capacity; select a skill to see supporting tasks | US3.1 |
| Explanation and correction | Original occupation source; task reasoning and limitations; return to edit tasks and rerun | US4.1, US4.2 |
| Learning focus | Selected skill, self-selected foundation, relevant work experience and confirmed learning goal | US5.1 |
| Learning resources | Search/filter courses; review content, outcomes, prerequisites, access and available duration | US5.1 |
| Course detail and guidance | Course content and known chapter details; context-linked practice guidance clearly identified as guidance | US5.1 |
| Saved courses | Save/remove courses, export the whole saved list and return in the same account/work context; removing a saved course does not remove scheduled learning | US5.2 |
| Prepare learning | Select whole course or available chapters; distinguish provider duration from personal study estimate | US5.2 |
| Study preferences | Select routine or Schedule later; routine includes positive total duration, valid start date, days and 30-minute window | US5.2 |
| Weekly plan | Learning, work, care and personal events; new weekly everyday activity covers four weeks; work weekdays and date range up to one year | US6.1 |
| Import course schedule | Future preferred study windows, skipping overlapping commitments still assigned to the user; final session uses remaining minutes | US6.1 |
| Activity detail and edit | Edit or delete only the chosen everyday occurrence; explain validation problems and preserve saved changes | US6.1 |
| Conflict detail | Identify overlapping activities still assigned to the user; edit arrangements; show an available flexible-activity suggestion when one exists | US6.2 |
| Prepare help request | Review/edit a message and open WhatsApp; recipient selection and sending happen in WhatsApp | US6.2 |
| Record help outcome | User records waiting, declined or accepted; user remains responsible until acceptance is recorded | US6.2 |
| Changed activity with help record | Changing title/date/time/shareability clears earlier assistance; remind the user to contact the helper | US6.2 |
| Learning progress | Per-course and overall completed/planned session counts; last scheduled date; exclude everyday activities; complete and undo | US6.3 |

Suggested connected demonstration: My skills → Learning focus → Learning resources → Course detail → Prepare learning → My Plan → Conflict detail → Prepare help request → Record acceptance → Complete a learning session. E1–E4 should remain available as the preceding journey.

## Required error and alternate states

| Area | State to show | Expected recovery |
| --- | --- | --- |
| Tasks | No tasks or a task with an unclear description | Explain the problem and return to task editing |
| Analysis | Uncertainty or results that do not reflect actual work | Show explanation/source and Edit tasks |
| Learning resources | No selected skill | Choose a skill |
| Learning resources | Skill without courses or filters with no matches | Explain which case applies; keep the selected skill or adjust filters |
| Course information | Unknown duration, prerequisites, access or chapter information | Mark unknown information honestly; allow whole-course choice when chapters are unavailable |
| AI guidance | Generating, generation failed or outdated advice | Show a clear status and retry/update; preserve user-confirmed details |
| Learning preparation | No selected chapters, no routine days, nonpositive duration, past date or end before start | Explain the specific field to correct; do not claim the selection was added |
| Learning preparation | Course already has scheduled sessions | Direct the user to My Plan to change scheduled learning |
| Schedule later | Selected content without dated sessions | Keep the course available in My Plan |
| Activity | Blank title or invalid date/time range | Keep the edit open and show a correction message |
| Course import | Missing details or too few available windows | Explain the issue; allow adjustment/manual session; retain sessions successfully imported |
| Assistance | Waiting or declined request | Keep the user responsible and show the recorded status |
| Assistance | Recorded acceptance | Show the helper as responsible; do not imply the website independently verified acceptance |
| Assistance | Relevant event detail changed | Clear earlier help record and remind the user to contact the helper |
| Progress | Save failed | Show an error and do not present the failed completion change as saved |
| Return later | Same account and work context | Show saved learning and plan state; label any simulated return state as a prototype example |

## Content and AI boundaries

Provider titles, durations, outcomes, prerequisites, chapters and access conditions must come from the supplied catalogue or verified sources. Missing details stay unknown. Invented example content must be visibly labelled “Prototype example.”

The pasted architecture describes one API for a draft recommendation basis and another for course advice based on the confirmed basis version and course data. The design should show explicit user review, sources for advice, stale advice and retry states. AI guidance must not overwrite confirmed information, chapter choices or schedules. Program rules, not the LLM, calculate study time and schedules.

The user's self-selected foundation is not an AI assessment of proficiency. Practical advice is not a guarantee that a course or career direction suits the user.

The website opens a prepared WhatsApp link. It does not send a message, choose a recipient, confirm delivery or read a reply. A Figma demo should simulate this handoff without sending a real message.

## Future concepts: E7–E9

| Epic | Concept coverage | Boundary |
| --- | --- | --- |
| E7: Career possibilities | Current role; existing/developing skills; possible directions; skills to explore for a chosen direction | Exploration, not a guaranteed job match or employment prediction |
| E8: Relevant AI updates | Work/topic preferences; recent source/date; task and skill implications; save an update; choose/pause frequency | Concept only; no live news feed or notification delivery is claimed |
| E9: Familiar language and pace | Language switch with preserved state; care mode with simpler content and a next step; return where the user stopped | Concept only; supported languages, translation review and reminder channels are not specified |

E7–E9 have user stories but no acceptance criteria or iteration commitment in the pasted text. Keep them on a separate concept page so users do not mistake them for agreed Iteration 2 delivery.

## Questions and working assumptions

1. **Story numbering:** E7 uses US7.1–US7.3. E8 also uses US7.1–US7.3. E9 uses US8.1–US8.3. Preserve the supplied identifiers with their epic labels until the team agrees corrected numbering; do not silently renumber the source.
2. **Study window:** AC5.2.3 says “a 30-minute study window.” It does not establish whether this is exactly 30 minutes or a minimum. Use an exact 30-minute example for the prototype and flag the general rule for confirmation.
3. **Learning goal:** AC5.1.1 says “manually entered learning goal,” while supporting text and current code allow suggested drafts. Make manual entry available and require explicit user acceptance before using an optional AI suggestion.
4. **Account transition:** E1 is account-free, while later criteria promise returning in the same account/work context. The exact sign-in/save transition is not specified. Do not add an account gate before analysis or promise anonymous cross-device saving.
5. **Missing provider facts:** Unknown duration is not zero. Show separate user-estimated study time where the requirements allow it, and clearly label its source.
6. **Partial imports:** AC6.1.4 preserves successfully imported sessions while showing issues. Design a partial-success state, not only all-success/all-failure.
7. **Source freshness:** Course availability and research statements need source checks before public claims. A visual prototype does not perform that verification.

## User review checklist

- [ ] The journey matches Verlyss's work and caregiving needs.
- [ ] Screens preserve the current product identity and use readable, plain English.
- [ ] The E1–E4 context is clear without distracting from E5/E6.
- [ ] Foundation, work experience and learning goal remain user-controlled.
- [ ] Course facts, unknown information, personal estimates and AI guidance are visibly distinct.
- [ ] Saving, scheduling later and adding a routine are clearly different actions.
- [ ] The weekly plan shows work, care, personal and learning commitments clearly.
- [ ] The conflict flow makes responsibility and the manual WhatsApp handoff clear.
- [ ] Complete/undo and save-failure states show honest progress.
- [ ] The main flow can be followed by clicking its controls, with a clear way back.
- [ ] Important empty, error and alternate states are represented or explicitly recorded as remaining work.
- [ ] Mobile layouts remain usable and text/control contrast is checked.
- [ ] E7–E9 are visibly labelled future concepts.
- [ ] The story-numbering, 30-minute-window and account-transition questions are resolved or recorded as open.
- [ ] The visual direction is approved before application implementation begins.

## Feedback template

Copy this block for each review item:

```text
Reviewer and date:
Figma screen or link:
Epic/story:
What I expected:
What was unclear or did not work:
Suggested change:
Priority: must fix / should fix / optional
Decision and owner:
Status: open / accepted / revised / verified
```

## Verification record

### Current continuation: 15 September 2026

Fresh `whoami` matched `leekuanloong17@gmail.com`, `Kuan_'s team`, View seat and Starter plan. A fresh `use_figma` call remains blocked by the Starter MCP quota. The user then signed in to the regular Figma editor, where work continued. All three original pages were verified, earlier work was preserved, and 81 current screen assets were imported as native frames. IDs are recorded in [the native import registry](native-figma-imports.json).

Native links are in progress. [The link registry](native-prototype-links.json) contained 40 recorded interactions at this documentation snapshot; the final count is pending. Locally generated assets include 81 wireframes and seven proposals. Native import of wireframe boards and proposals remains pending at this snapshot. Screenshot comparison is under way; the full desktop and mobile journey has not yet been verified in Figma Present mode.

Current source was inspected with targeted source reads because codebase-memory was unavailable. The actual current frontend was rendered with an isolated local fixture API using repository reference data. The local learning-to-plan journey, missing-days validation and completion/undo were checked. These checks do not verify a live backend, provider facts, account authentication or cross-device saving. Use [the frontend map](current-frontend-map.md) and [capture manifest](screen-assets/manifest.json) for current visual evidence.

No tracked application edits, deployment, commit or billing change were made. Application integration remains pending visual approval. This remains a design/review checklist, not a completed application audit or a claim that every acceptance criterion has been implemented.

### Earlier work: preserved history

The earlier task created the editable Figma file in Drafts. Initial writes created pages, tokens, styles, components and screen shells before the Starter MCP quota stopped that connector work. Those historical IDs remain in `figma-state.json`; the connector block no longer means all Figma editing has stopped.

The earlier source review used Codegraph and targeted reads. References included `LearningCentre.tsx`, `RecommendationBasis.tsx`, `CourseDetailDrawer.tsx`, `useCourseLibrary.ts`, `Plan.tsx` and `scheduleCourses.ts`, under `frontend/src/pages/`.

The local HTML design draft contains 29 screen definitions, including E1–E6 flows, alternate states and three future concepts. It supports wireframe and polished views. Syntax and link-destination checks passed. Browser testing covered the learning focus, course search, scheduling validation, 30/30/15-minute scheduling with a skipped care window, help responsibility, completion, undo and reload persistence. Desktop and mobile checks are detailed in the README.

Those concept checks do not establish fidelity to the current frontend or verify the native Figma journey. The regular editor is the current continuation path while MCP quota remains unavailable.
