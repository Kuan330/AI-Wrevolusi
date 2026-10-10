# Interview practice (Epic 9)

## Where it lives

Page: `/career/possibilities/interview` (sidebar: Possibilities → **Interview practice**). A user can practise for the future occupation chosen in Possibilities without making a resume. Possibilities also has a **Practise for an interview** link after a direction is chosen. A reviewed Epic 8 resume remains an optional way to practise from personal work and project examples. Resume editing stays in Epic 8; course choice stays in the learning module.

## Flow

1. **Start.** The chosen future occupation is shown with a **Practise for this occupation** action. It uses that occupation's reference question bank and public role title, with no resume or resume review requirement. **Practise general questions** also remains available. Optional resume practice shows the target role (first line of job requirements) and resume version. Only this path requires **I reviewed this resume** in the resume builder. Later changes to chapters or requirements require review again, without blocking occupation or general practice.
2. **Review what AI receives.** For resume practice, the user sees the redacted items, can add private words to hide, and must tick a confirmation before AI is used. Where current, exact research links exist, the user can explicitly link a work-experience entry to a confirmed work task. The task's published AI-impact score and source then accompany that same entry. Unverified, possible or stale matches are not sent as evidence. The redacted role title is kept with the session and reused for feedback. Older sessions without this redacted copy omit the role from feedback requests.
3. **Questions.** Three to five per set, with four requested by default. Resume questions link to a resume item, a requirement framed as practice, or at most one AI-at-work topic with matching work-item and research evidence. Occupation practice uses occupation-bank questions, with safe role-based questions filling any shortfall. General practice works even if the bank is unavailable. Without AI, template questions still provide the requested three to five questions. Every question says it is a practice example, and every question can be skipped.
4. **Answer** by typing or speaking. Voice uses the browser's own speech recognition. We never record or store audio. Recording state is shown, can be stopped or cancelled, and ends when the user leaves. The transcript is editable and nothing is sent until the user submits. An empty answer asks for content. If analysis fails the answer is kept and can be retried.
5. **Feedback** quotes the user's words and covers four checks (answered, own actions, concrete example, judgement) plus an AI-check when the question is about AI. Improvements are split into expression, missing example and possible skill gap. Too little information is marked uncertain. At most two follow-up questions per question. Follow-ups use a verified quote from the answer and a safe clarification instead of repeating model-invented facts. The user can reply, say "that is not what I said", or skip.
6. **Try again** shows both full answers and compares feedback checks. The answer-history selector can reopen any saved attempt, including failed feedback. Draft changes go straight into the existing local save queue, so fast exits and question switches do not cancel a pending debounce. It does not score competence.
7. **Send a point to my resume.** The user edits their own words and sends them as a suggestion on the matching entry. The resume only changes when the user accepts it in the resume builder, where it can be undone.
8. **Strengthen a skill.** A possible skill gap, with the question and answer that support it, can be sent to learning only after the user confirms. It opens the learning resources. Nothing is added to the plan.

## Data and privacy

| Data | Where it stays |
| --- | --- |
| Sessions, answers, transcripts, feedback, drafts | IndexedDB `aiwrevolusi.interview.local.v1` in this browser, keyed by account. Not in the account workspace sync. Up to 20 sessions, deletable one by one. |
| Resume and review mark | The existing Epic 8 local record (`aiwrevolusi.resume.local.v1`). |
| Question bank | Neon reference tables `ref_interview_*` (reference data only). |
| Personal data in the database | None. |

A session keeps its own role, occupation code and resume items where applicable. Later changes to the resume or chosen occupation do not rewrite it or change the occupation used for a learning handoff.

## Backend

All routes need sign-in and return `Cache-Control: no-store` (the bank lookup uses `private`).

| Endpoint | Purpose |
| --- | --- |
| GET `/api/v1/interview/question-bank?occupation_code=` | Reference questions: exact occupation, else the 3-digit family, else common. |
| POST `/api/v1/interview/plan` | 3 to 5 questions from the redacted items. Falls back to template questions when AI is off or its output is rejected. |
| POST `/api/v1/interview/feedback` | Feedback on one answer. Needs AI. |

Both AI routes reuse the Epic 8 provider settings (no fallback chain, no cache, one correction attempt). Output checks reject personal-topic questions, assumed AI use, judgements about the person, hiring predictions, quotes that are not in the answer and skills outside the supplied list. A reply that says the user has not used a tool is never counted as a weakness.

## Question bank

See `data/reference/interview/README.txt`. Load it with `db/seed_reference.py --interview-only --init`. The app's job list is ISCO-based while the bank is MASCO, so about 89 of 427 job codes have no exact match and use the family fallback.

## Known limits

- Speech recognition needs a Chromium or Safari browser; other browsers use text.
- Text guards are conservative. They are not proof that every possible AI wording is safe; live provider quality and physical microphone behaviour need separate checks.
