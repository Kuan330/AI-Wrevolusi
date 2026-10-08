# Resume assistant and browser model priorities

## Using the features

- Open **Possibilities → Resume builder**. Existing local drafts open directly.
- The assistant is anchored below the form/YAML editor. Quick instructions only fill the composer. Send with the arrow or Ctrl/Cmd+Enter.
- Before the first send, review the redacted context and instruction. Add extra private terms if necessary. Personal header values and the redaction map stay in the browser. Manual context changes require renewed review.
- Review proposed sections and design changes before applying. You can apply a subset, discard, undo/redo, or use **Resume options → Undo AI changes**. Invalid YAML and outdated proposals cannot be applied. Conversation memory disappears when leaving the page or changing accounts.
- Courses shows the deduplicated recommendation count, including courses already added. Select individual available courses or all available courses; adding uses the existing My courses operation.

## Developer model preferences

Click the home footer **© 2026 AI-Wrevolusi** ten times, with no more than two seconds between clicks. Keyboard activation is supported. The hidden entry is not an administrator permission mechanism.

The dialog accepts one to five distinct model IDs, in priority order. **Apply** persists the list under `aiwrevolusi.developerModels.v1` in this browser only; it is excluded from account/workspace sync. Updates notify this and other same-site tabs. **Restore defaults** removes the override.

With an override, every AI feature uses the existing **AI_API_KEY / AI_BASE_URL / AI_API_MODE** primary service configuration, not the separate learning provider. Models must be supported by that service. Credentials and service URLs cannot be changed through this dialog. Overrides require a configured key, disable content caching/anonymous relay fallback, share the rate limiter across model choices, and do not mutate server settings. Restoring defaults restores each feature's original provider behavior.

Transport/model availability failures may advance to the next specified model within the request budget. Credential failures, invalid requests, malformed structured output and factual/safety rejection do not. A factual rejection in resume generation or editing gets at most one correction from the same successful model, with the original redacted inputs and fixed feedback only. No rejected response is sent back. Resume generation/assistant use a shared 45-second AI budget and a 55-second client timeout. Exhausting the budget can stop before all models are attempted.

## API and privacy

`X-AIW-Models` contains a JSON array on application AI requests. Missing headers preserve default behavior. The server validates count, uniqueness, length and characters; request-scoped context isolates browsers and concurrent requests.

`POST /api/v1/resume/assist` is authenticated and stateless. It accepts `instruction`, reviewed `document` sections/design, `skills`, `context_reviewed` and bounded `history`. It returns `message`, indexed `sections` with cited entries, and scalar safe `design` changes. Job descriptions and chat history are not factual evidence. Names, employers, roles, qualifications, dates, numerical facts and private placeholders remain protected. Blank drafts cannot acquire fictional skills or experience. Only built-in RenderCV 2.8 design controls are accepted.

There are no new database tables, draft storage fields or uploaded original documents. AI text is transient and never logged/cached by this feature. Replies and errors use `Cache-Control: no-store`; errors retain `detail` with optional safe `code`/`fields`. Third-party provider retention policies still apply. PDF rendering still temporarily receives the complete local document, using the existing isolated renderer and cleanup.

## Verification

Run the existing frontend full check and backend offline suite. Additional coverage is in `model-preferences.test.mjs`, `resume-assistant.test.mjs`, `test_model_overrides.py`, `test_resume_assistant.py`, and `resume-assistant.browser.mjs`.

Browser checks run against the production build, with synthetic accounts/AI/catalogue and the real local RenderCV QA renderer (`tests.resume_preview_server`, port 8016). They do not contact a real supplier. Vercel Preview rendering and real-provider checks still need separate authorization/verification; local success is not a deployment claim.
