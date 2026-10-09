# Interview practice (Epic 9)

## Where it lives

Page: `/career/possibilities/interview` (sidebar: Possibilities → **Interview practice**). It builds on the Epic 8 resume builder. Resume writing and editing stay in Epic 8; course choice stays in the learning module.

## Flow

1. **Start.** The page reads the local resume draft. It shows the target role (first line of the job requirements) and the resume version. Practice from the resume needs a version the user marked **I reviewed this resume** in the resume builder. Any later change to the chapters or the requirements makes it "needs review" again. Without a reviewed version the user is sent to the resume builder and can still choose **Practise general questions**.
2. **Review what AI receives.** The user sees the redacted items, can add private words to hide, and must tick a confirmation before AI is used. Contact details never leave the device.
3. **Questions.** Four per set, each linked to a resume item (work, project, skill, summary), a role requirement (framed as practice) or one AI-at-work topic. Every question says it is a practice example, and every question can be skipped.
4. **Answer** by typing or speaking. Voice uses the browser's own speech recognition. We never record or store audio. Recording state is shown, can be stopped or cancelled, and ends when the user leaves. The transcript is editable and nothing is sent until the user submits. An empty answer asks for content. If analysis fails the answer is kept and can be retried.
5. **Feedback** quotes the user's words and covers four checks (answered, own actions, concrete example, judgement) plus an AI-check when the question is about AI. Improvements are split into expression, missing example and possible skill gap. Too little information is marked uncertain. At most two follow-up questions per question. The user can reply, say "that is not what I said", or skip.
6. **Try again** compares two attempts by check. It shows which points were covered. It does not score competence.
7. **Send a point to my resume.** The user edits their own words and sends them as a suggestion on the matching entry. The resume only changes when the user accepts it in the resume builder, where it can be undone.
8. **Strengthen a skill.** A possible skill gap, with the question and answer that support it, can be sent to learning only after the user confirms. It opens the learning resources. Nothing is added to the plan.

## Data and privacy

| Data | Where it stays |
| --- | --- |
| Sessions, answers, transcripts, feedback, drafts | IndexedDB `aiwrevolusi.interview.local.v1` in this browser, keyed by account. Not in the account workspace sync. Up to 20 sessions, deletable one by one. |
| Resume and review mark | The existing Epic 8 local record (`aiwrevolusi.resume.local.v1`). |
| Question bank | Neon reference tables `ref_interview_*` (reference data only). |
| Personal data in the database | None. |

A session keeps its own copy of the role and the resume items, so later resume edits do not rewrite it.

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

- AI at work: AI-impact results are fetched live and not stored on the device, so the planner receives confirmed work tasks as topics instead of stored results.
- Speech recognition needs a Chromium or Safari browser; other browsers use text.
- Live AI output was not verified against a real provider (the configured key was rejected). Flows were checked against a local stand-in model.
