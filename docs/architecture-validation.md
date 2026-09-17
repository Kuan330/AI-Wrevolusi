# Architecture change validation

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
