# Possibilities resume builder

## Scope and entry points

The authenticated child route is `/career/possibilities/resume`; `/resume` still opens Continue Journey. The workspace sidebar presents **Possibilities** as a collapsible parent, matching Learning & growth, with **Explore possibilities** and **Resume builder** children. Search, collapsed-menu expansion, mobile drawers and the focused editor menu use the same hierarchy; only the current child receives the active-page marker. Possibilities exposes Generate resume without a selected skill. The existing Add to Skill Path action is a separate button beside the matched-skill disclosure, retaining its previous save/navigation protection.

The editor recreates the official visitor editor’s compact workbench using this project’s common controls and brand. It uses a top toolbar, continuous left-hand editing and a continuous actual-PDF preview on the right, with CV / Design / Settings tabs and a YAML switch. The official online frontend is not published; no bundled online code, iframe or official example-person data is used. It supports all nine entry types and built-in themes, nested list controls, safe model-derived Design/Settings fields and advanced locale settings through YAML, PDF/YAML downloads, selective AI chapter replacement, 50-step in-memory Undo/Redo and the persistent AI undo snapshot. The heavy editor is lazy-loaded. There is one current draft per account; changing target requirements warns the user to export and only replaces the target when a proposal is applied.

Explore possibilities requires a valid selected occupation before Generate resume can be clicked (skill selection is not required). The account-isolated selection is saved before navigation. Resume builder loads the selected occupation and all its required WEF skills from the authenticated `/api/v1/possibilities/{occupation_code}/requirements` endpoint; it has no editable job requirements or example shortcut. Change target role returns to Explore possibilities. Missing, invalid or empty roles show a recovery prompt and block generation without removing an existing resume. Opening the page never invokes AI.

Generation candidates are merged from reviewed explicit source skills, confirmed platform skills and selected learning/planned skills (including canonical mappings from saved/pending courses). Unselected recommendations and occupation requirements are never user abilities. The combined Skills preview stays removed; uploaded-source review fields and essential loading/error/retry prompts remain. Course mapping failures block generation instead of dropping names or treating course titles as skills.

Final Skills include only candidates related to the selected role. Exact normalized standard-name/database associations are protected; the same single AI call evaluates the remaining candidates against server-owned requirement skill IDs. Semantic associations are model judgments, not verified database mappings or claims of proficiency/completed study. Full original labels are preserved, one per bullet. No candidates and no reviewed evidence disables generation with an add-details prompt. The separate Open an empty template action remains a manual, local editing option and never calls AI or courses.

## Local data and privacy boundary

`infrastructure/storage/resumeStore.ts` owns a separate IndexedDB database `aiwrevolusi.resume.local.v1`, with a `drafts` object store keyed by authenticated account ID. The record holds pending/current job requirements, the original Blob, reviewed/redacted text, local contact mapping, reviewed source skill names, optional source project metadata, generation-input fingerprints and applied Skills-filter version/fingerprint, document, raw YAML, last successfully rendered document for preview recovery, proposal, undo snapshot, gaps and optional recommendations. It is **not** an accountStorage/workspace sync key and has no database table or persistence API.

- Every edit queues an atomic transaction. Only completed writes display Saved on this device.
- Revision checks stop stale tabs from overwriting newer records. Malformed records are preserved until the user explicitly clears them.
- Logout/account change unmounts the account-keyed editor, aborts pending requests and drops in-memory previews. IndexedDB survives logout.
- Clearing drains writes, blocks concurrent edits and deletes only that account's resume record.
- Missing/quota-blocked storage shows a warning and keeps the current in-memory document editable/exportable; recovery is not promised.
- Same browser and same site only. Clearing site data, private browsing expiry and browser eviction can lose drafts. Account namespacing is not device encryption.

PDF/DOCX originals are never uploaded. PDF.js and Mammoth extract **text**, not imported HTML, inside a dedicated parsing worker. PDF.js uses an explicit nested worker port (automatic browser initialization assumes window/document). Limits: one file, 10 MB; PDF 20 pages; extracted text 60,000 characters. DOCX central-directory and actual streamed inflation are both bounded (40 MB total, 10 MB per entry, 2,000 entries); encrypted/path-traversing/duplicate/malformed ZIP entries fail. No OCR or password collection. Suggested contact redaction and Skills-block extraction are conservative suggestions, **not** a guarantee; the user must review them and confirm before AI receives evidence/source skills.

The original My Plan file controls route PDF/DOCX into the local repository and keep the unsubmitted form intact. TXT/MD/CSV retain their existing reference workflow. A My Plan resume never enters synced `resources`. The resume page reads the same repository but still requires job requirements.

Skills merge confirmed skills, learning-list/Skill Path/learning-goal selections and reviewed explicit source skills. The shared learning-list implementation lives under `features/skills`; the old page import is a compatibility re-export. This feature treats learning-list skills as available without claiming mastery, credentials or completion and does not change other pages' skill-state rules.

## Transient authenticated endpoints

| Endpoint | Input / output |
| --- | --- |
| POST `/api/v1/resume/generate` | Job requirements, candidate skill IDs/names, optional reviewed redacted evidence -> English chapter proposal, source IDs and gaps |
| POST `/api/v1/resume/recommend-courses` | Gaps -> up to five validated catalogue course IDs, gap IDs and reasons |
| POST `/api/v1/resume/render` | Complete structured RenderCV document -> binary PDF |
| GET `/api/v1/resume/capabilities` | Non-secret configured provider hostname/model and pinned renderer version for disclosure |

Use the existing `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_MODE` and optional `AI_EXTRA_HEADERS` configuration. A missing explicit key disables resume generation, not manual editing/rendering. Resume AI constructs a separate configured provider with keyless disabled, no fallback chain, no content cache and no retries. Other AI features retain their previous gateway behavior. No real supplier request is needed by offline tests. Third-party retention policies still apply; the UI does not promise zero supplier retention.

No original evidence means Skills only. Each AI entry must cite supplied skill/fact IDs; non-skill chapters require original facts. Full generation assembles one complete Skills section as one independent bullet per complete skill label (up to 250 candidates, 160-character names and one skill reference per entry; other sections and assistant edits retain 80-entry limits); it never silently truncates. Shared partial-entry grounding stays independent so assistant edits do not need to cover every skill.

Generation accepts optional `source_projects` records with `id`, `mode`, `fact_ids`, immutable `name`/`date`, and ordered `highlight_fact_ids`. New clients always send the array, including when empty. Local parsing works from redacted evidence and recomputes on edits. Clearly identified projects are reviewed with their original individual highlights; ambiguous sections are passed through unchanged, without guessed metadata or AI polishing. Responses optionally include `project_id` and a `project` (`name`, `date`, `highlights`), applied as RenderCV normal entries rather than a flattened bullet. The server rejects new projects, changed identities/dates/numbers, merged highlights, cross-project references and project facts recast as employment. Existing requests and drafts without these optional fields remain readable. Automatic grounding remains conservative rather than a proof of semantic factuality; users must review suggestions.

Changes to target, reviewed evidence or skill inputs invalidate in-flight generation and unapplied proposals using account-scoped input fingerprints. Existing content and its applied interview target stay unchanged until selected suggestions are applied; undo restores content, not the upstream selected occupation.

Recommendations are independent of generation. They shortlist actual catalogue titles/descriptions/outcomes and skill tags, then use the configured provider only to select from that pool. IDs/gap links are rechecked and deduplicated on the server; weak tag-only matches are excluded. Empty results and DB/provider/query failures return an empty list, so the UI quietly omits the optional area. Selection uses the existing `changeSavedCourses` operation. Only normal course/plan selections sync, never requirements/evidence/resume content. A local course addition does not claim that account sync already completed.

Resume responses, including validation/auth failures, use `Cache-Control: no-store`. Validation errors do not echo rejected request values. Logging records status/timing/error category, not bodies or exception strings containing private values. Rendering does temporarily receive the complete document (including personal fields), separately from redacted AI input; the UI explicitly discloses both transfers.

## Actual RenderCV/Typst rendering

The Python dependency is locked to `rendercv[full]==2.8`. The worker uses its actual model builder, theme templates and Typst PDF compiler, not HTML printing. Each request gets a parent-owned temporary directory, fixed filenames, explicitly UTF-8 JSON input and a short-lived process. Default timeout is 25 seconds; at most two workers run per application process. Compiler package files are inside the same request directory, so success/failure/forced timeout all remove them. PDF responses are bounded to 4 MB.

Only built-in themes and safe design/settings fields are permitted. Custom themes/templates, photos, output paths/commands, prototype keys, raw Typst/math code, file links and embedded resources are rejected. The public renderer adds a literal Markdown/quoted-link boundary instead of the CLI's intentional raw-Typst passthrough. Native font and package resolution uses installed/bundled assets only; user fields cannot provide imports or resource paths.

The published 2.8 wheel bundles RenderCV's Typst package but not its FontAwesome dependency. The pinned official MIT `fontawesome:0.6.0` package is vendored under `app/data/resume/preview/fontawesome/0.6.0`, including LICENSE and SOURCE.json with upstream attribution/checksums. The exported frontend schema preserves the pinned upstream licence in RENDERCV-NOTICE.txt, also shipped in public/licenses. Python package-data includes it. All nine themes have actual offline PDF regression tests, including a nameless Skills draft and a multi-page document.

PDF.js CMaps, standard fonts and WASM are copied from the committed frontend dependency lock by `scripts/pdfjs-assets.mjs` during predev/prebuild. No CDN resources are used. Do not bypass those hooks when launching Vite manually unless the assets have already been generated.

The shared schema and `rendercv-2.8.controls.json` control metadata are exported from the **installed pinned version**, not GitHub main:

```powershell
backend/.venv/Scripts/python.exe scripts/export_resume_schema.py
```

The isolated worker uses context-aware escaping for quoted template data (including PDF title, name and separators). Only the two engine-owned footer page-counter expressions remain executable Typst; user strings still pass the original safety validation and Markdown escaping. This preserves real page numbers rather than printing internal code.

The exporter removes only invalid non-string title/description annotations emitted by 2.8; it does not remove validation constraints. Form/YAML share the same document. Invalid/unknown YAML stays as raw local text, disables destructive form/AI changes, and retains the last valid preview, including reconstruction from the local successful-render snapshot after reopening. Rendering is debounced and abort/version guarded; download uses the same bytes as the current valid preview, never a stale response.

## Editing workbench details

- A resume document activates route-local focus mode: the project sidebar, normal page header and footer are hidden. The toolbar’s workspace-menu button opens the existing navigation drawer. Returning to another route restores the original global sidebar preference without rewriting it. Account/sync alerts remain visible above the workspace; the editor fits the remaining viewport height, and the backup action wraps on narrow screens.
- The panes start 50/50 with a pointer/keyboard separator (Left/Right; Home resets). The actual workspace width, not device identity, controls the Edit/Preview layout below 900px. Both panes scroll independently; long CVs never make the document body scroll sideways.
- CV shows personal fields followed by every chapter in document order. Chapters collapse, rename, reorder and confirm before deletion. Entries and Highlights/Authors/Social networks/custom connections have individual list controls. Empty inputs never import fictitious facts.
- Bold/Italic/safe-link formatting requires a selection in a Markdown-capable CV field. It is disabled in YAML, Design and Settings. Input grouping uses a 500ms window per field; structural actions have separate history steps. History is account-local memory, capped at 50; reopening starts a fresh memory history while the existing AI undo snapshot still survives.
- Model metadata supplies each theme/language’s effective defaults. Viewing tabs does not add defaults to YAML. Only edited paths are written, with special handling for prior scalar typography overrides. Explicit overrides and unknown YAML are retained; there are no photo, remote resource, custom template or command/path controls. Locale has no dedicated form tab: new drafts use English defaults, and advanced users can edit `locale` in YAML. Existing locale overrides survive form edits, reopening and rendering unchanged. Locale changes fixed labels/date wording only, not user facts or generated-language rules.
- RenderCV 2.8 defaults make text-based chapters unbreakable through `entries.allow_page_break`. For an unusually long Skills/Text chapter, explicitly enable Design → Entries → Allow Page Break; this preserves the pinned theme defaults rather than silently rewriting them. The long-document regression uses that real exported control.
- The PDF preview keeps page placeholders for a continuous document and renders only visible/adjacent canvases with a pixel budget. It supports page jumping, fit width and zoom. Rendering cancels obsolete work and uses the same valid PDF bytes for downloading.
- Target & AI opens the existing requirement/source-review workflow in a dialog. Courses opens a focus-trapped right-hand drawer only when actual recommendations exist. Resume options holds YAML export, persistent Undo AI changes, privacy details and confirmed local clearing. Existing storage/API formats are unchanged.

### Free-text contact fields

Email, phone and website are optional free-text fields, not format-gated inputs. The editor and original YAML retain exactly what was entered, including local phone numbers and website labels without protocols. Blank scalar values and list rows are omitted from the render-only copy. The isolated worker keeps these values outside RenderCV's typed contact validators and renders them as escaped Typst string literals, preserving header order, existing social/custom connections and list order. Contact strings are not parsed as Markdown/code or turned into automatic hyperlinks; other content retains the existing safe-link/code restrictions. No country code, URL prefix or substitute contact is invented. The phone-number-format design control is hidden because literal phone text is no longer automatically reformatted. Only basic text/list structure and size limits apply, with no additional saved fields or API changes.

## Verification

Use the project's Node 24.19+ / npm 12.0.2 environment:

```powershell
cd frontend
npm run check
cd ..
backend/.venv/Scripts/python.exe -X utf8 -m pytest backend/tests -q --basetemp=backend/.pytest-resume-validation
```

The test suite is offline. The Windows-only socketpair helper permits asyncio's own ephemeral self-pipe while ordinary network/DB `connect` and `connect_ex` remain blocked. UTF-8 mode and a workspace-local basetemp avoid platform encoding/temp permission issues; no developer `.env` secrets are used in tests.

For isolated browser QA, install/provide Playwright externally, generate PDF.js assets, then run these two local servers in separate terminals:

```powershell
backend/.venv/Scripts/python.exe -m uvicorn tests.resume_preview_server:app --app-dir backend --host 127.0.0.1 --port 8016 --no-access-log
# Inside frontend:
npm run dev -- --port 5186
```

In a third terminal inside frontend, `node tests/resume.browser.mjs`. If Playwright is supplied by a workspace runtime, set `AIW_PLAYWRIGHT_MODULE` to that installed package. The default headless browser channel is Chrome (`AIW_QA_BROWSER_CHANNEL` can change it). API interception uses synthetic accounts, catalogue and AI outputs and blocks external URLs. Only render requests reach the synthetic-auth local renderer. **Never deploy tests.resume_preview_server**. It is outside the installed `app` package.

The production-build browser workflow additionally verifies focus-mode/menu preference preservation, 50/50 splitter pointer/keyboard controls, no document mutation on tab viewing, Markdown/Undo/Redo, Design/Settings edits and YAML-only locale compatibility across reopening, lazy multi-page preview and desktop/tablet/mobile overflow. It also verifies mandatory target input, retry/restore, identical PDF download/preview bytes, course partial/all selection, YAML error recovery, selective chapter application/undo, PDF/DOCX import, invalid/oversized/textless sources, My Plan handoff without form submission, local source-skill review, desktop/mobile tabs, keyboard tab navigation, actual pagination/zoom, account isolation, logout retention and clearing. `AIW_QA_ENCRYPTED_PDF` optionally supplies a synthetic encrypted file for that negative case. Screenshots/synthetic artifacts are ignored under `.local/resume-qa`.

## Release gates still requiring hosted verification

Local tests are **not** Vercel Preview evidence. Before releasing, deploy an authorised Preview and verify the Linux Python/Typst wheel, bundled fonts/FontAwesome, subprocess support, writable temporary space, dependency/function size, duration limits, authenticated routing and actual Skills/multi-page PDF responses. Also test a configured supplier with intentionally synthetic evidence and review its current retention policy. No deployment, real-person upload or live course addition is performed by the implementation checks. The October 2026 skills/latency check additionally sent one fully synthetic, one-fact summary to the locally configured supplier; it completed in 4.94 seconds with verified output. This is a smoke result, not a full-resume latency guarantee.

Review npm audit before release. The current dependency tree has outstanding advisories, including existing toolchain dependencies and newly used transitive packages. Do not run broad `audit fix --force` upgrades without a separate compatibility review. The static bundled schema and disabled format validation limit the Ajv URI-parser surface, but this is not a substitute for addressing dependency advisories.


## Generation correction and private diagnostics

Normal reviewed English ability wording (including Able, Skilled, Comfortable and Familiar) no longer fails merely because of capitalisation. Reviewed generic past-tense words still need cited facts; references, names, numbers, credentials and executable/resource content remain constrained. This is a conservative heuristic, not a guarantee of semantic fact verification.

New clients submit `source_sections`, `source_projects` and `occupation_code`. The server reuses the same uncapped database requirement/card mapper, validates the exact requirements text and reviewed section/fact ownership, and builds selected Skills and project identities deterministically. At most one asynchronous `resume.polish.v3` call returns fact-ID text patches plus short candidate-ID decisions anchored to server-owned role requirement IDs (or null for unrelated), not another whole resume. Requests without `occupation_code` retain the existing v2 flow. Each patch is independently grounded; rejected or omitted patches retain reviewed original text. Unclear projects and non-polishable source paragraphs never go to AI.

The call has a cancellable 60-second wall deadline, with a 70-second browser budget. Browser abort/disconnect cancels the upstream HTTP coroutine and closes its client. Timeouts, transient transport failures and invalid model output return an explicit `outcome: source_preserved` with fixed-code `notices`; invalid input, configuration/access errors and internal errors are not disguised as success. Role-filtered source-preserved results contain only standard-confirmed relevant user Skills (uncertain semantic candidates are excluded), original structured/raw projects and all reviewed source sections, including supported original additional headings. While generating, the UI shows a blue/lilac indeterminate progress bar, understated elapsed time and Cancel generation; no completion percentage is fabricated and reduced-motion preferences are respected. Results display the preservation reason. Existing resumes change only after selected chapters are applied. Source preservation never changes the applied/interview target or requests new gap courses.

Legacy requests without `source_sections` retain the existing strict full-response validator and at-most-one correction in the shared 45-second budget (55 seconds in old clients). Editing-assistant partial grounding remains unchanged. Neither flow caches private payloads or uses hidden transport retries.

Errors keep their string `detail` and HTTP status, adding optional `code` and `fields` (up to five paths of fixed schema keys and numeric indices). Chapter names and unknown field keys are not returned; the browser resolves numeric chapter positions from its local document. RenderCV errors preserve the previous valid PDF and the user's YAML. Render requests remain debounced and run again only after a document change or explicit retry. Free-text contact behaviour is unchanged. Logs contain fixed codes, attempts, status and elapsed time, never resume or generated content. Current access logs alone do not identify the user's earlier 422 cause; these diagnostics locate future rejections without guessing or weakening RenderCV validation.

## Skills/projects offline acceptance

`frontend/tests/resume-sources.browser.mjs` exercises local DOCX/PDF parsing, all skill sources, source coverage with synthetic fact-ID patches and anchored relevance decisions, structured project identity/dates/highlights, verbatim fallback, review/apply/undo, refresh, stale results, account isolation and catalogue retry. Use the production preview on 5186 and the synthetic-only `tests.resume_preview_server:app` on 8016. That QA app now overrides the generation provider as well as authentication; never deploy it. Outputs stay ignored under `.local/resume-qa/skills-projects/`.


## Skills extraction and single-pass regression

Skills extraction now stops at shared resume section boundaries (including Professional Experience), removes category prefixes, and keeps shared-qualifier phrases intact. Source version 2 stores one manually reviewed skill per line and optional extraction/edit provenance. Legacy auto-extracted skills are rederived from reviewed text without changing the uploaded file or current document; definite manual history pollution requires correction. WEF selections use standard names by ID, and selected course-title legacy labels resolve to canonical course mappings, never course-completion claims.

`test_resume_generation.py` covers the compact call, per-fact safety, exact names/dates/counts, literal extra sections, whole-call fallback, real async-transport cancellation, client disconnect, authentication/configuration/internal errors and source tampering. `resume-skill-extraction.test.mjs` covers the insurance sample, legacy contamination, source boundaries and canonical learning labels. All regression tests use synthetic data. A single authorised configured-supplier smoke request used only synthetic text and completed in 4.94 seconds; hosted deployment and full-size supplier latency remain separate release checks.

`frontend/tests/resume-latency.browser.mjs` verifies the insurance fixture, hidden combined preview, canonical course labels, legacy auto-skill migration without document changes, transient/schema-error fallback, source-preserved review/apply/undo/PDF, elapsed/cancel/retry and mobile layout. Outputs are ignored under `.local/resume-qa/skills-latency/`.

### Independent Skills bullets and pagination

Generation preserves complete labels (including commas) as one bullet per skill. Existing drafts are not split or rewritten automatically; apply a new reviewed proposal to use the layout. The isolated pinned-engine adapter makes text-based section blocks follow `design.sections.allow_page_break`, rather than locking all consecutive bullets to `design.entries.allow_page_break`. Structured project/experience entries retain their original entry-pagination setting. Neither the user's YAML nor installed engine files are changed.


## Role-relevant Skills contract and acceptance

- `occupation_code` is optional for compatibility; the current page always sends it. Unknown/empty roles and reference database errors are explicit recovery errors. A requirements mismatch returns `target_role_changed` (409), with Retry role requirements; it never calls AI against stale inputs.
- `skill_filter_version: "role_relevance_v1"` marks the generation result. Every pending candidate needs exactly one valid reference/null decision. Unknown candidates/requirements, duplicates or omissions exclude that affected candidate and emit `skill_relevance_incomplete`; already-validated text patches and other decisions survive. Direct standard matches cannot be deleted by AI. No association is not proof of a missing ability; uncertain/excluded candidates do not create new gap claims.
- The 60-second backend/70-second browser budgets, one-call cap and real cancellation remain. Whole-call timeout/transport/parse failure preserves reviewed facts and only direct mapped skills. Configuration, authentication, invalid sources and internal errors remain errors, not fallback successes. Logs contain only codes/counts/outcome/timing, not private text.
- `no_related_skills` with reviewed non-Skills evidence returns an explicit empty Skills proposal, allowing generation without that chapter. Applying that selected chapter deletes the old Skills key; not selecting it keeps the old list and its previous filter proof. No related skills and no reviewed non-Skills content returns `no_related_input` rather than an empty generated resume.
- Fingerprints include the filter version, current role, all candidates and reviewed sources. Old-rule or stale un-applied proposals are cleared, not the saved resume. Applied Skills proof changes only when Skills is applied; manual/assistant Skills edits invalidate it. Partial chapter application displays an unapplied-filter warning. Undo/redo/AI undo restore proof and content while preserving the current role selection. Source-preserved results never advance the applied interview target.
- `test_resume_relevance.py` covers standard/semantic matching, malformed decisions, no invention, single-call cancellation/fallback, 1/80/81/250 independent skills, server reference errors and route binding. `resume-relevance.test.mjs` covers empty-section application, proof/history/legacy records and the 70-second wire contract. `resume-relevance.browser.mjs` uses synthetic-only auth/DB/AI with the real local generator to exercise all skill sources, selective filtering, unchanged sources/profile/learning, reference retry, conservative fallback, partial/empty application, undo, PDF export, cancellation and stale-account isolation. Artifacts stay ignored under `.local/resume-qa/role-relevance/`; this does not claim hosted or live-provider validation.
