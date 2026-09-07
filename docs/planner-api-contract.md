# Planner frontend and future API

The first version uses `localPlanRepository` (browser storage). No server routes or WhatsApp delivery integration are implemented. `remotePlanRepository` provides the same async load/save contract using the existing authenticated API client; switch the repository factory in Plan.tsx after server implementation and authorization tests. Never silently fall back from a failed remote write to local data.

## Proposed endpoints (distinct from the existing schedule router)

- GET `/api/v1/planner/state`: return `PlanState`.
- PATCH `/api/v1/planner/state`: accept a complete snapshot plus `expectedRevision`; return the normalized snapshot with incremented revision. Atomically return 409 if the revision differs. The server must scope both operations to the authenticated user, validate all values, and use a transaction. Return 401 when signed out and 422 for validation errors.

`PlanState`: `{version: 1, revision: number, events: PlanEvent[]}`.

`PlanEvent` fields: `id` (UUID for new activities), `title` (1–160 characters), `kind` (learning/work/care/personal), `date` (YYYY-MM-DD), `start` and `end` (HH:mm, end strictly after start on the same day), `flexible`, `shareable`, optional `resourceId`, `completed`, optional `assistance`.

`assistance`: `{name, message, status, updatedAt}`. Name and message are required, max 80 and 2000 characters. Status is draft/pending/accepted/declined. `updatedAt` is an ISO timestamp. Only shareable care activities should carry assistance; validate this server-side. The initial UI displays local wall times in the browser timezone. Before remote multi-device rollout, add a persisted IANA timezone to the contract and explicit DST/ambiguous-time validation rather than inferring a different zone on each device.

## Responsibility and assistance rules

- Draft creation, copying, and opening a WhatsApp link do not send a request or change responsibility.
- “I sent the request” records the user's report and changes draft to pending. There is no delivery receipt.
- Only pending can be marked accepted/declined. Replies are recorded manually by the user, not verified by WhatsApp.
- Pending and declined leave the original user responsible. Accepted delegates this activity and removes it from the user's overlap checks. Family members' availability is unknown.
- Changes to title/date/start/end/shareability invalidate the old assistance. UI tells the user to contact their helper separately. Delete/cancel never sends a cancellation message.
- The user chooses a recipient and sends the reviewed message in WhatsApp, using `https://wa.me/?text=<encoded text>`. No outbound messages, access tokens or phone-number database are required by this prototype.

## Scheduling semantics

Intervals are half-open: adjacent activities are not conflicts. Fixed events can be manually edited but do not receive automatic move suggestions. Suggestions are user-confirmed, in the next seven days from the selected activity between 08:00 and 21:00, based only on saved activities. No assumptions about actual free time or family calendars.

Repeat creates four independent weekly occurrences. Editing/deleting affects only one occurrence, explicitly stated in the UI. Course sessions are time allocations, not automatically inferred course chapters. Marking learning complete is self-reported.

## Storage and preview

Real: `aiwrevolusi.planner.v1`; demo: `aiwrevolusi.planner.demo.v1`. Both use revision checks and fail visibly on invalid/unwritable storage. The local read/check/write is not an atomic cross-tab transaction; server compare-and-swap is required for multi-client use.

`/plan?demo=1` is available only in development and contains example work, care and learning activities with one initial conflict. The learning-resources demo passes its selected resources using router state. Production retains the existing confirmed-analysis gate. No real analysis or shortlist is written by the demo.
