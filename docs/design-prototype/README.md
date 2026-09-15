# AI-Wrevolusi design prototype

This folder preserves an earlier simplified Iteration 2 concept, its concept wireframe view, requirement map and review notes. **That local concept is not a faithful copy of the current frontend and must not be used as the visual source for Figma.**

## Accepted checkpoint — 15 September 2026

The user accepted the current design checkpoint and asked to stop further work. Figma contains **82 current desktop/mobile screens**, with **136 recorded native connections**. Read [the checkpoint handoff](checkpoint-handoff.md) for exact completed work, the unfinished calendar link, and verification limits.

The connection is **leekuanloong17@gmail.com · Kuan_'s team · View · Starter**. The signed-in editor worked despite the MCP quota block. Application integration has not started.

Four wireframe boards (82 screens) and seven proposed/future assets are saved locally but have not been imported into Figma. Full native journey verification and final comparison remain unfinished at this accepted checkpoint.

## Earlier concept — preserved for reference

[Open the local design prototype](http://127.0.0.1:8766/)

Use **Journey map** to choose among 29 screens and states. Use **Wireframes** to switch the same flow to a low-fidelity view. This is a review artifact built with plain HTML/CSS/JavaScript, not a second React project or an integration into the existing app.

[Open the editable Figma design](https://www.figma.com/design/v7f5dr4CBH1KDNA7fOxctD)

The earlier task created this Figma file in Drafts, with three pages, colour/spacing tokens, Inter styles, three reusable components and three unfinished screen shells before hitting the Starter connector quota. That describes the earlier work, which remains preserved. The current continuation verified all three original pages and added the native screen imports described above. `figma-state.json` keeps the historical IDs and current progress separately. The clickable prototype is still being completed.

## Intended result

A reviewable prototype should show how Verlyss can understand her work, select useful learning content, make a practical study routine around work and care, resolve a conflict, and record learning progress. It should include a journey map, low-fidelity wireframes, a connected high-fidelity flow, and important error and empty states.

The earlier local concept is available for reference only. Its own learning-to-planning flow was tested in the earlier task; those checks do not establish fidelity to the current frontend. Figma completion and application integration remain pending. The requirement map is a design checklist, not a claim that all production acceptance criteria have been implemented.

## Start here

- Read [Requirements and review](requirements-and-review.md) for the source, screen map, open questions and feedback checklist.
- Review the actual frontend captures and imported Figma frames for Work profile → Tasks → AI exposure → Skills → Learning resources → My Plan. Use the earlier local concept only as a separate reference.
- Focus the Iteration 2 review on E5 and E6. E1–E4 provide the preceding work-analysis journey. E7–E9 remain clearly labelled future concepts.
- Record feedback with the template in the review document before approving the visual direction.

## Existing design language

Use the current frontend as the reference, with readable text and clear controls:

- Inter font, as loaded in `frontend/index.html`.
- Main blue `#4F91BA`; deep blue text `#3D5F7A`; body text `#2F2430`.
- Brown `#C7958B`, rose `#E7BDBC`, pink `#F9E0E4`, light sky `#C7DBEB`, sky `#9EC9E4`.
- Soft blue and pink backgrounds, white panels, rounded cards and pill-shaped buttons.
- A desktop content width around 1180px, adapted for mobile. Preserve the actual baseline in current-screen frames; put readability improvements, including larger calendar labels, in the proposed design section.

The source already includes learning-resource and planner screens. The prototype should build on these patterns rather than imply E5 and E6 are entirely new.

## After visual approval

Implement the approved experience in the existing frontend on the intended prototype branch. Reuse its React, TypeScript, Tailwind and UI components. Use realistic, clearly identified example data where live data is unnecessary. Do not create a second React application inside the repository.

Backend and database changes need a separately agreed scope after the experience is approved. This design handoff does not claim production functionality, live AI generation, message delivery, cross-device saving or validated course availability.

## Run locally

From the repository root:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory docs/design-prototype
```

The server serves only this artifact folder. The live application and backend are not needed. `index.html` can also be opened directly, although browser storage behaviour can differ for local files.

## Earlier concept: review behaviour and limits

- Task edits, learning-focus confirmation, search/filter, save/remove, saved-list JSON export, chapter choices, routine scheduling, activity edits, help outcomes, completion/undo and care-mode reduction use local UI state.
- Local storage uses `aiwrevolusi.designReview.v1`, separate from application storage. It does not create accounts or sync devices. Reset example clears only this prototype's data.
- Scheduling is a bounded example: selected days, 30-minute windows, one-year search, fixed example work hours, skipping care/personal overlaps and a final partial session. Full work-hours configuration, manual learning-session editing and all production scheduling cases remain in the application work scope.
- Other states are clearly marked illustrative. The source text in `data.js` remains editable for future Figma construction. Future E7–E9 screens are concepts, not implemented services.
- All course titles, content and assessments are example fixtures. Provider information remains unknown. The WhatsApp button opens an editable prepared message; it does not select a recipient or send. No message was sent during testing.
- The initial example starts on 21 September 2026. Choose a later start date if reviewing after that date.

## Earlier concept: checks performed

- JavaScript syntax checks passed for `data.js` and `prototype.js`.
- All 29 screen keys are unique and all declared screen destinations resolve.
- Browser checks passed for focus → search/no-results recovery → course → chapter/time preferences → calendar.
- Missing study days were rejected. A 75-minute estimate produced 30/30/15-minute sessions, skipping the Wednesday care overlap.
- Waiting retained responsibility; recorded acceptance transferred it. Complete/undo updated counts, completion survived reload, and a simulated failure preserved the previous count.
- Desktop planner inspected at 1440px. Mobile progress layout and document bounds checked at 390px with no horizontal document overflow. Wireframe toggle and screen index checked. The batch sweep of every screen timed out, so full visual verification of all 29 screens is not claimed.

This continuation has made no tracked application edits, deployment, commit or billing change. Application integration remains pending visual approval.
