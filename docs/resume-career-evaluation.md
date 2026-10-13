# Epic 8 accuracy and career relevance evaluation

The feature connects reviewed CV facts, selected platform skills, self-recorded learning and occupational reference data. A general rewrite does not establish those sources or preserve their ownership. The Career alignment panel lets users inspect the evidence behind the applied version rather than accepting a model-generated score.

## Fixed inputs

Use `backend/tests/fixtures/resume_career_cases.json` with the same CV for **2421 Management and Organisation Analysts**, **2512 Software Developers**, and **4111 General Office Clerks**. Keep the model/settings, input skills, reviewed sources and learning selections constant while changing the role. Cases cover the insurance background, two projects (Apr 2026 and Nov 2025; 2,400/36/180), completed versus unfinished/unsynchronised courses, practice, multi-source skill duplicates and ambiguous project boundaries.

The fixture includes the bundled reference snapshots plus clearly labelled synthetic requirements for contract comparisons. The local reference CSV has **no checked task/skill mapping for 4111**. Production must display unavailable requirements; never substitute ISCO 4110, add a guessed mapping, or describe the mock fixture as the real database. Resolve this reference-data issue separately before a real 4111 comparison. Recommendation algorithms are unchanged.

## Factual gate

Reject any changed/invented name, employer, held position, date, number, project identity/ownership or source attribution. All Skills must come from reviewed/selected user candidates. A learning intention cannot produce course completion, certification, employment, a project or proficiency. Project permutation must preserve every original record. Ambiguous projects and unstructured work chronology remain in original order. Claimed course completion requires complete catalogue chapters and every synchronised progress row at 10/10. No inferred completion date is acceptable.

Automated tests use mock providers to exercise references, invalid fragments, complete fallback, single-call deadlines/cancellation, application, undo/redo, persisted account separation and actual PDF rendering. Passing these tests establishes program behavior and safety contracts; it does **not** establish real-model semantic accuracy.

## Human relevance rubric

Each reviewer independently scores each criterion 0 (unsupported/incorrect), 1 (partly useful/unclear), or 2 (clear and supported). These are evaluation scores, never a user-facing job-fit or ATS percentage.

| Criterion | What the reviewer checks |
| --- | --- |
| Relevant background | Summary and presentation select useful reviewed facts for the stated career; objective is not a held role. |
| Sound associations | Each original candidate meaningfully supports its specific requirement, beyond a shared industry or vague association. |
| Evidence support | Quoted CV/practice/completion source really supports the described emphasis, and intentions remain intentions. |
| Distinct emphasis | Comparing the same input across careers yields reasonable differences in summary facts, candidate selection and reliable project priority. |

Record case, occupation code, reference availability, model/version, reviewer, four scores, false associations, omissions, factual violations and comments. List disputed examples and have a second human review them. Factual-gate failures cannot be rescued by a high relevance score. Do not use the generating model as its own sole reviewer.

| Case | Career | Reference available | Reviewer | Background 0–2 | Associations 0–2 | Evidence 0–2 | Distinctness 0–2 | False links / omissions | Fact failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| insurance_two_projects | 2421 | Check current database | Pending | — | — | — | — | Pending real-model sample | Pending |
| insurance_two_projects | 2512 | Check current database | Pending | — | — | — | — | Pending real-model sample | Pending |
| insurance_two_projects | 4111 | Missing in bundled data | Pending | — | — | — | — | Requires checked reference data | Not evaluated |

Real-provider samples require separate authorization. This implementation does not make those calls, claim empirical model relevance, or infer that missing support establishes a missing personal ability.

## Reproduce offline checks

From the repository root, run `uv run --locked --project backend pytest backend/tests/test_resume_career.py backend/tests/test_possibilities_requirements.py -q` and the frontend `check` script. On Windows set `PYTHONUTF8=1` when running the full backend suite, since several pre-existing CSV fixtures rely on the interpreter's default encoding.

For the synthetic browser app, run `uvicorn tests.resume_preview_server:app --host 127.0.0.1 --port 8016` in the backend uv environment and preview the built frontend on port 5186. Use installed Playwright/Chrome to run `frontend/tests/resume-career.browser.mjs`. This uses synthetic authentication and must never be deployed. Screenshots, real rendered PDF and the offline result manifest are saved under ignored `.local/resume-qa/career-evidence/`.

## Recorded offline acceptance — 12 October 2026

The related backend suite passed **455 tests**; the frontend passed **540 tests**, architecture boundary checks, lint and the TypeScript/Vite production build. Existing dependency deprecation/serialization and bundle-size warnings remain; there were no failed checks. The final summary wording change was additionally checked against all 32 career tests.

Offline browser acceptance passed for Epic 8, target-role handoff, role relevance, skills/projects sources, insurance extraction and fallback, the compact editing assistant, and the full resume workbench regression. Checks include explicit review before the first CV is created, optional slow learning progress without delaying an unselected learning flow, grounded role-specific summaries, independent Skills bullets, whole-project priorities, partial application, undo/redo, old drafts, account isolation, desktop/mobile layout, actual PDF rendering/download and upstream assistant cancellation. PDF browser suites were run serially to respect the renderer's concurrency limit.

The three-role contrast uses deliberately synthetic provider decisions and requirements. It verifies assembly, references and source preservation, not actual model semantic relevance. No real-provider samples were requested, no human rubric scores were fabricated, and the bundled 4111 reference gap remains explicit. The browser result manifest and screenshots are under the ignored local QA folder described above.
