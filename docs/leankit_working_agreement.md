# LeanKit Working Agreement

This is the operating rulebook for the [FIT5120 2026S2 TM11 LeanKit board](https://monashie.leankit.com/board/2494573303). It converts the Monash [LeanKit Dos and Don'ts](https://learning.monash.edu/mod/url/view.php?id=5731584) guidance into checks that a person or agent can apply consistently.

## Scope

Apply these rules to live cards in:

- `BACKLOG - FUTURE WORK`
- `TO DO THIS ITERATION`
- `DOING` and `IN PROGRESS`
- `BLOCKED`
- `REVIEW BY MENTORS`
- `DONE`

Archived cards are excluded unless the user explicitly asks to inspect or change them.

## Authority

1. Use the team's current approved design artefact as the product-scope authority.
2. Use an explicit team or user decision for ownership, dates, priority, and lane changes.
3. Treat preliminary notes and old cards as evidence, not authority.
4. When sources conflict, record the conflict and request a decision. Do not silently combine them or invent a rule.

## Card hierarchy

- Epic title: `E<number>: <outcome>`
- User-story title: `US<epic>.<story> <interaction or outcome>`
- Acceptance-criteria title: `AC<epic>.<story>: <short outcome>`
- Each user story must have the correct epic as its parent card.
- Each acceptance-criteria card must have its user story as the parent card.
- Keep acceptance criteria in the `AC` child card, not in the user-story description.
- Apply the `AI-Wrevolusi`, `Epic` or `User Story`, and iteration tags consistently.
- Use colour only to improve recognition; colour never replaces labels or written meaning.

## Definition of Ready

A user story may move into `TO DO THIS ITERATION` only when all of these are true:

- The title and parent epic are correct.
- The description identifies a persona, interaction, and user benefit.
- A linked `AC` child card contains testable criteria that match the story.
- Required references or designs are linked or attached.
- The team has agreed who owns the implementation tasks.
- Dependencies or blockers are recorded.
- Timing is recorded when the team has agreed it.

Future work may remain less detailed in the backlog. Complete the missing Ready items before moving it into the iteration.

## User-story template

```text
As a [persona],
I want to [interact with the product],
so that [user benefit].

Value
[Why this matters and how it supports the persona or epic.]

References
- [Approved design or persona]
- [UI or journey-map artefact]
```

An informational page, embedded video, or external link is not sufficient by itself. The story must describe meaningful interaction with this product and an observable outcome.

## Acceptance-criteria card template

Create one child card for each user story. Keep all criteria for that story in this card.

```text
Title: AC<epic>.<story>: <short outcome>
Parent card: US<epic>.<story>

AC <epic>.<story>.1: Given [starting condition], when [user action], then [observable result].
AC <epic>.<story>.2: Given [edge case], when [action], then [safe observable result].

Evidence
- [Implementation or test evidence]
```

## Task rules

- Break each current-iteration user story into actionable tasks before work starts.
- Give every task one named owner. Multiple people may be assigned to the story, but their tasks must show who does what.
- Start task titles with an action: `Implement`, `Design`, `Validate`, `Test`, `Document`, or another concrete verb.
- State the output or completion condition in the task.
- Split frontend, backend, data, design, and testing work when different people own them.
- Record due timing only when agreed; never guess a date.
- Move each task with the work so its state remains current.

Weak task:

```text
Add more information — everyone
```

Acceptable task:

```text
Implement MASCO occupation search results — Owner: [name]
Done when: title, description, and source render for a successful match and the empty result is handled.
```

## Lane and status rules

- `BACKLOG - FUTURE WORK`: not committed to the current iteration.
- `TO DO THIS ITERATION`: Ready and committed, but implementation has not started.
- `DOING` / `IN PROGRESS`: active work with current task ownership visible.
- `BLOCKED`: work cannot proceed; add a comment with the reason, owner, needed action, and date noticed.
- `REVIEW BY MENTORS`: implementation evidence is ready and the requested review is stated.
- `DONE`: acceptance criteria are verified, tasks are complete, and evidence is linked.
- Keep the card's status consistent with its lane so epic progress is accurate.

## Communication and history

- Put decisions, blockers, hand-offs, and material progress in the relevant card comments.
- A WhatsApp, Teams, or meeting discussion is not the record. Add its outcome to LeanKit.
- Keep project files in the approved shared repository or governance folder and link them from the card.
- For rejected or changed live work, retain a visible history and explain the reason. Do not delete the evidence.

## Definition of Done

Before moving a story to `DONE`, verify:

- Every acceptance criterion has evidence.
- All tasks are complete.
- The delivered behaviour matches the story and approved design.
- Relevant code, deployment, test, design, or data evidence is linked.
- Remaining limitations or follow-up work are stated.
- The card status and lane both reflect completion.

## Agent procedure

When an agent updates the board:

1. Read this file and inspect the live board before editing.
2. Ignore archived cards unless the user explicitly includes them.
3. Resolve the exact card, parent, lane, assignees, and current content.
4. Edit only fields supported by approved artefacts, repository evidence, or an explicit team decision.
5. Never infer a person's ownership, a deadline, completion, or mentor approval.
6. Re-open every edited card and verify the saved title, description, AC child card, tasks, assignees, parent, tags, lane, and status.
7. Report the exact cards changed and any decisions still required.

## Pre-save checklist

- [ ] Correct `E`, `US`, or `AC` identifier
- [ ] Clear outcome-based title
- [ ] Persona + interaction + benefit
- [ ] Acceptance criteria are in a linked `AC` child card, not the user-story description
- [ ] Testable Given/When/Then criteria
- [ ] Criteria align with the story, epic, and approved design
- [ ] Correct parent epic and iteration tag
- [ ] Actionable tasks with one named owner each
- [ ] Dependencies and blockers recorded
- [ ] References or evidence linked when available
- [ ] Lane and status agree
- [ ] No ownership, date, completion, or approval was guessed

## Live-board audit baseline — 2026-09-02

Scope: live-board overview plus detailed inspection of `E1`, `US1.1`, `US2.3`, and `US5.1`. This is a dated sample, not a substitute for re-auditing current state.

What is working:

- The board has clear backlog, iteration, doing, blocked, review, and done lanes.
- Epics and user stories use consistent `E` and `US` identifiers.
- Parent-card relationships and iteration tags are present on the inspected stories.
- Each Iteration 1 user story now has a linked `AC` child card containing its Given/When/Then criteria and production-check notes.

What needs attention:

1. Planned dates are blank on the inspected live cards. Add them only after the team agrees the timing.
2. `US5.1` has a story but no acceptance criteria or owner. This is acceptable while it remains future backlog work, but it is not Ready for an iteration.

Recommended cleanup order:

1. Add agreed dates, blockers, and supporting links.
2. Complete future stories only when they are selected for an iteration.
