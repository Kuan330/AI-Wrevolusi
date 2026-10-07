# Possibilities resume builder

## Scope and entry points

The authenticated child route is `/career/possibilities/resume`; `/resume` still opens Continue Journey. Possibilities exposes Generate resume without a selected skill. The existing Add to Skill Path action is a separate button beside the matched-skill disclosure, retaining its previous save/navigation protection.

The editor recreates the official visitor editor’s compact workbench using this project’s common controls and brand. It uses a top toolbar, continuous left-hand editing and a continuous actual-PDF preview on the right, with CV / Design / Locale / Settings tabs and a YAML switch. The official online frontend is not published; no bundled online code, iframe or official example-person data is used. It supports all nine entry types and built-in themes, nested list controls, safe model-derived Design/Locale/Settings fields, PDF/YAML downloads, selective AI chapter replacement, 50-step in-memory Undo/Redo and the persistent AI undo snapshot. The heavy editor is lazy-loaded. There is one current draft per account; changing target requirements warns the user to export and only replaces the target when a proposal is applied.

The first-use requirements field offers a fixed **Use an example** classroom shortcut (Junior Data Analyst). It only fills editable job requirements, confirms before replacing different text, and never seeds skills or personal facts. With no skills or reviewed evidence, the primary action creates a local empty Skills draft without an AI/course request, even when AI is unavailable. Skill loading must succeed; unreviewed evidence still blocks generation. Existing drafts never use this fallback. The generate API's empty-source rejection is unchanged. Provider/model details are not displayed; essential privacy disclosures remain available in an expandable **Privacy details** section.

## Local data and privacy boundary

`infrastructure/storage/resumeStore.ts` owns a separate IndexedDB database `aiwrevolusi.resume.local.v1`, with a `drafts` object store keyed by authenticated account ID. The record holds pending/current job requirements, the original Blob, reviewed/redacted text, local contact mapping, reviewed source skill names, document, raw YAML, last successfully rendered document for preview recovery, proposal, undo snapshot, gaps and optional recommendations. It is **not** an accountStorage/workspace sync key and has no database table or persistence API.

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

No original evidence means Skills only. Each proposed entry must cite supplied skill/fact IDs. Non-skill chapters require original fact IDs. Contracts reject extra output fields, unrecognised citations, unsupported sections, ungrounded numbers/named entities (including non-Latin names), unsupported proficiency/seniority/credential claims and unsafe output. Skills labels alone cannot substantiate past-tense achievements or course completion. These conservative automated guards are not a proof of semantic factuality; users should check wording against the cited evidence. Original names, institutions, positions, dates/degrees and measurable claims must not be invented.

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
- Bold/Italic/safe-link formatting requires a selection in a Markdown-capable CV field. It is disabled in YAML, Design, Locale and Settings. Input grouping uses a 500ms window per field; structural actions have separate history steps. History is account-local memory, capped at 50; reopening starts a fresh memory history while the existing AI undo snapshot still survives.
- Model metadata supplies each theme/language’s effective defaults. Viewing tabs does not add defaults to YAML. Only edited paths are written, with special handling for prior scalar typography overrides. Explicit overrides and unknown YAML are retained; there are no photo, remote resource, custom template or command/path controls. Locale changes fixed labels/date wording only, not user facts or generated-language rules.
- RenderCV 2.8 defaults make text-based chapters unbreakable through `entries.allow_page_break`. For an unusually long Skills/Text chapter, explicitly enable Design → Entries → Allow Page Break; this preserves the pinned theme defaults rather than silently rewriting them. The long-document regression uses that real exported control.
- The PDF preview keeps page placeholders for a continuous document and renders only visible/adjacent canvases with a pixel budget. It supports page jumping, fit width and zoom. Rendering cancels obsolete work and uses the same valid PDF bytes for downloading.
- Target & AI opens the existing requirement/source-review workflow in a dialog. Courses opens a focus-trapped right-hand drawer only when actual recommendations exist. Resume options holds YAML export, persistent Undo AI changes, privacy details and confirmed local clearing. Existing storage/API formats are unchanged.

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

The production-build browser workflow additionally verifies focus-mode/menu preference preservation, 50/50 splitter pointer/keyboard controls, no document mutation on tab viewing, Markdown/Undo/Redo, Design/Locale/Settings edits, lazy multi-page preview and desktop/tablet/mobile overflow. It also verifies mandatory target input, retry/restore, identical PDF download/preview bytes, course partial/all selection, YAML error recovery, selective chapter application/undo, PDF/DOCX import, invalid/oversized/textless sources, My Plan handoff without form submission, local source-skill review, desktop/mobile tabs, keyboard tab navigation, actual pagination/zoom, account isolation, logout retention and clearing. `AIW_QA_ENCRYPTED_PDF` optionally supplies a synthetic encrypted file for that negative case. Screenshots/synthetic artifacts are ignored under `.local/resume-qa`.

## Release gates still requiring hosted verification

Local tests are **not** Vercel Preview evidence. Before releasing, deploy an authorised Preview and verify the Linux Python/Typst wheel, bundled fonts/FontAwesome, subprocess support, writable temporary space, dependency/function size, duration limits, authenticated routing and actual Skills/multi-page PDF responses. Also test a configured supplier with intentionally synthetic evidence and review its current retention policy. No deployment, real-person upload, live course addition or supplier request is performed by the implementation checks.

Review npm audit before release. The current dependency tree has outstanding advisories, including existing toolchain dependencies and newly used transitive packages. Do not run broad `audit fix --force` upgrades without a separate compatibility review. The static bundled schema and disabled format validation limit the Ajv URI-parser surface, but this is not a substitute for addressing dependency advisories.
