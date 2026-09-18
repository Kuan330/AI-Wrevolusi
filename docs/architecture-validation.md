# Architecture change validation

## 18 September 2026 follow-up

Starting code: `639951a`. The results below cover the follow-up changes recorded
in this revision.

- Stored-task exposure requires an authenticated owner. The progress read API
  returns only the signed-in user's chapter values.
- Task responses retain the optional profile-task compatibility field without
  requiring a new database column.
- Rejected AI evidence no longer returns through the fallback path. Stale tests
  were aligned with the current Task Assist and matching contracts.
- Plan progress is saved as pending work before network calls and has explicit
  retry and server reconciliation. Check-in uses current state and account
  guards. Explicit course removal cancels its pending progress writes.
- The frontend uses Node 24.19.0 and npm 12.0.2 for development and CI. Compatible
  later Node 24 patches remain supported. Strict TypeScript is enabled.
- The CI definition runs locked frontend, backend, data and launcher checks.
  Vercel's frontend commands explicitly select the same npm version.

| Check | Result |
|---|---|
| Frontend combined check on Node 24.19.0 | Passed, including 86 tests and production build |
| Backend and data-parser tests | 281 passed, including in-memory SQLite tests |
| Launcher and toolchain contract tests | 15 passed |
| Mocked browser progress flow | Passed restore, failure, reload, retry and check-in |
| Mocked Possibilities policy states | Passed invalid-profile recovery, cleared profile and current profile |
| Whitespace check | Passed |

The old nine backend failures were reproduced on the unchanged starting code.
The full current suite passes without excluding or quarantining those tests.
Test fixtures clear real provider/signing credentials and block network sockets.

No package installation, live database connection or deployment was performed.
The CI workflow and hosted npm commands have not run remotely. Browser API calls
were mocked. PostgreSQL bootstrap, concurrency and existing-schema adoption
remain separate verification work. Older local progress without a pending entry
is retained rather than assigned an invented historical study date.

The approved policy changes are complete. Occupation creation through HTTP is
disabled while public reads remain available. A modern workspace profile is
authoritative for Possibilities, including cleared and unconfirmed states.
Malformed modern data returns a recovery error. An account read failure does not
fall back to old records. Legacy behavior is retained only when no modern
profile exists. The 21 added policy cases passed, with 17 failing against the
previous source as expected. Database bootstrap remains separate by agreement.

## 17 September 2026 baseline

Reviewed against clean starting commit `818cfae` on `kuan/design-prototype`.
The code changes were committed locally as `aa4f8fb` after these checks. No
packages were installed, no database was connected or changed, and nothing was
pushed or deployed.

## Delivered scope

- Keep page-based UI; extract shared work-profile and learning/planning contracts,
  persistence and course operations. Generic UI uses shared presentation modules.
- Preserve learning records and calendar entries on profile changes; structural
  changes set an optional review flag, while practice-only changes do not.
- Use one add/remove operation for Plan and Learning Resources. Guard asynchronous
  operations and pending workspace saves against account changes. Keep explicit
  guest import and guest-only legacy migration; remove signed-in browser mirrors.
- Separate optional device preferences from account workspace data.
- Restore the frontend check command and enforce resolved import boundaries.
- Validate shortlist shapes and tolerate legacy invalid shortlist values on reads.
- Use atomic PostgreSQL conflict handling for learning writes; task services own
  the commit for task data and derived exposure.
- Clean up partial launcher startup and require locked UV execution.

See [frontend architecture](../frontend/ARCHITECTURE.md) for ownership and
[database baseline proposal](database-baseline-proposal.md) for deferred schema work.

## Checks run

| Check | Result |
|---|---|
| `cd frontend && npm run check` | Passed: boundaries, lint, 72 Node tests, TypeScript and production build |
| Focused backend persistence, transaction, account and learning tests | 86 passed |
| Guarded broader backend suite | 225 passed, 9 existing failures |
| Mocked launcher unittest suite | 6 passed |
| Shell syntax check for `dev` | Passed |
| `git diff --check` | Passed |
| Browser smoke with isolated context and in-memory API | Passed |

Frontend checks used the available Node 26.6.0; the documented target remains
Node 24. No fresh dependency installation or Node 24 run was performed. Lint
warnings remain. The production build warns about its roughly 702 kB JavaScript
chunk; route splitting remains a separate measured improvement.

Browser checks covered the review notice in both learning views, acknowledgement
persisting after reload, Plan removal reflected in Learning Resources, adding a
course back from Learning Resources and seeing it in Plan after reload, and a
retained course staying at 60% progress. Explicitly removed and re-added courses
still start at zero locally. No page errors were observed in those flows. All API
requests were mocked, external requests were blocked, and the frontend process
and isolated browser context were closed after the check.

The backend run blocked socket and SQLite connections and excluded
`test_reference.py` and `test_reference_fuzzy.py`, which use database fixtures.
An isolated copy of the starting commit produced the same nine failures (199
passes before these new tests). The failures are:

- `test_ai_api_contract.py::test_published_and_runtime_output_limits_are_bounded`
- `test_ai_gateway.py::test_skill_route_uses_a_safe_gateway_fallback_for_malformed_provider_json`
- `test_ai_gateway.py::test_skill_provider_evidence_must_be_an_exact_task_substring`
- `test_task_assist.py::test_task_assist_answer_requires_a_server_owned_task_uuid`
- `test_task_assist.py::test_registered_detail_is_answered_from_the_server_snapshot_and_saved`
- `test_task_assist.py::test_second_question_returns_the_permanent_first_exchange_without_calling_ai`
- `test_task_assist.py::test_same_detail_is_isolated_by_authenticated_user`
- `test_task_assist.py::test_concurrent_requests_grant_only_one_provider_call`
- `test_task_assist.py::test_pending_state_recovers_to_saved_fallback_without_a_second_provider_call`

## Limits and follow-up

Offline SQL compilation and mocked sessions verify statement/response contracts,
not live PostgreSQL concurrency, rollback or schema compatibility. Migration
replay, deployment settings, real cookies, real catalogue data and hosted routing
were not verified. No migration or Vercel configuration was changed.

A separate source-level response-contract risk was observed: `TaskRead` requires
`profile_task_id`, but the Task ORM does not define it. That unrelated contract
was left unchanged and needs its own endpoint review.
