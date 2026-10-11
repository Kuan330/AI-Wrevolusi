# Resume builder response performance

Measured locally on 12 October 2026, on branch `ruiduo`. These checks use synthetic accounts, CVs and upstream responses. They do not call a real AI provider or establish real-model career relevance.

## Changes

- Start WEF reference, course catalogue and synchronised learning progress reads concurrently. Optional unselected learning records do not delay generation readiness. Refresh/account guards and load errors remain active.
- Validate form-produced structured documents directly using the same schema and contact/resource guards as YAML. Retain YAML parsing for manually edited YAML and emitted shared-reference aliases.
- Memoise unchanged section and entry rows. Stable callbacks read the latest committed document and sibling entries, so a later skill edit cannot overwrite a previously changed name or project.
- Avoid unnecessary history comparison clones and repeat proof invalidation. Stored and exposed undo snapshots still use deep copies, preserving isolation and the existing grouping/limit.
- Load the YAML editor when it is needed; focus/hover on its toolbar control prefetches it. The form editor remains immediately available.
- Reuse only successful exact-document PDF render results within the mounted account page session. The LRU retains at most four PDFs or 8 MiB. It includes all CV/design/settings fields, clears on successful local-CV removal and disappears on account workspace unmount. Explicit render retry bypasses the cache. The normal edit render delay remains 700ms.

## Controlled comparison

The baseline production build overlays recorded pre-optimisation sources without resetting the active checkout. Both builds run locally in separate previews and are tested serially using the same Chrome script. Each run disables browser network cache, applies 4× CPU throttling and delays each of three independent reference/catalogue/progress endpoints by 400ms.

Cold readiness is the median of three fresh browser contexts. Editing uses a synthetic document containing 250 Skills, original-style project records and career alignment metadata. Its 16-keystroke timings measure a native input event until two animation frames; Playwright locator lookup time is excluded. Undo timing includes the browser interaction and the export-ready PDF state. It is a short local comparison, not a production latency guarantee.

| Metric | Before | After |
| --- | ---: | ---: |
| Cold generation readiness, median | 2,890ms | 1,961ms |
| Independent dependency start spread, median | 835ms | <1ms |
| Input-to-two-frame median, 250 Skills | 349ms | 113ms |
| Input-to-two-frame p95, 16 samples | 589ms | 201ms |
| Undo to PDF export readiness | 2,643ms | 838ms |
| New server render requests for that Undo | 1 | 0 |
| ResumeBuilder route JS, uncompressed | 405,722 bytes | 95,292 bytes |

The 312,468-byte YAML editor is now a separate optional chunk. This reduces initial route loading; total application code is not reduced by that amount. Broader application/vendor bundles remain outside this change.

Raw JSON and screenshots are in ignored `.local/resume-qa/performance/` under the labels `before-measured` and `after-measured`. Earlier locator-inclusive and profiling reports are diagnostic only and are not used in this comparison. CPU microbenchmarks are supplementary, not end-to-end timings.

## Reproduction

1. Run `npm run check` from `frontend`.
2. Build and preview the normal frontend, for example on 5188.
3. With the recorded baseline files present, build using `node node_modules/vite/bin/vite.js build --config tests/resume-performance-baseline.config.mjs`, then preview that configuration on 5189. The build checks that all eight baseline overlays were applied and writes to the ignored baseline directory.
4. Set `AIW_PLAYWRIGHT_MODULE` to the available Playwright module, `AIW_QA_ORIGIN` to the preview, `AIW_PERF_LABEL` to a distinct report name, `AIW_PERF_PROFILE=0`, and `AIW_PERF_DIST_DIR` to that build directory. Run `node tests/resume-performance.browser.mjs` once for each preview, serially.
5. For real PDF and assistant-route regressions, run `python -m uvicorn tests.resume_preview_server:app --host 127.0.0.1 --port 8016` using the backend virtual environment, then run the related browser suites serially. This is a synthetic-auth QA app; it disables real AI keys and must not be used in production.

## Scope and verification

The performance browser script also checks latest sibling/entry values, move/delete/Undo, lazy YAML state, complete YAML export and persistence after reload. Unit tests cover snapshot mutation isolation, cache LRU/size limits, clear and separate cache instances, and parity of structured/YAML schema and resource checks. Runtime PDF and account/assistant regressions supplement these checks.

The final frontend check passed all 546 tests, boundary checks, lint (with existing repository warnings), TypeScript checks and the production build. All seven browser regression suites passed: the complete workbench, Epic 8 career evidence, role relevance, source Skills/projects, generation latency/fallback, target-role handoff and the real asynchronous assistant route. The latter verifies browser-to-ASGI cancellation with a synthetic provider; exported PDFs use the real local RenderCV engine.

The generation 60/70-second and assistant 90/100-second budgets, provider/model selection, career recommendation algorithm, autosave, review/apply flow and normal PDF render timeout are unchanged. Real provider/network latency is not measured by this work.

The three existing launcher files were checked against the recorded SHA-256 baseline and remain identical. Temporary QA previews and renderer were stopped after verification. No commit, push or deployment was performed.
