# Interview practice (Epic 9)

## Where it lives

Page: `/career/possibilities/interview` (sidebar: Possibilities → **Interview practice**). A user can practise for the future occupation chosen in Possibilities without making a resume. Possibilities also has a **Practise for an interview** link after a direction is chosen. A reviewed Epic 8 resume remains an optional way to practise from personal work and project examples. Resume editing stays in Epic 8; course choice stays in the learning module.

## Flow

1. **Start.** The chosen future occupation is shown with a **Practise for this occupation** action. It uses that occupation's reference question bank and public role title, with no resume or resume review requirement. **Practise general questions** also remains available. Optional resume practice shows the target role (first line of job requirements) and resume version. Only this path requires **I reviewed this resume** in the resume builder. Later changes to chapters or requirements require review again, without blocking occupation or general practice.
2. **Review what AI receives.** For resume practice, the user sees the redacted items, can add private words to hide, and must tick a confirmation before AI is used. Where current, exact research links exist, the user can explicitly link a work-experience entry to a confirmed work task. The task's published AI-impact score and source then accompany that same entry. Unverified, possible or stale matches are not sent as evidence. The redacted role title is kept with the session and reused for feedback. Older sessions without this redacted copy omit the role from feedback requests.
3. **Questions.** Three to five per set, with four requested by default. Resume questions link to a resume item, a requirement framed as practice, or at most one AI-at-work topic with matching work-item and research evidence. Occupation practice uses occupation-bank questions, with safe role-based questions filling any shortfall. General practice works even if the bank is unavailable. Without AI, template questions still provide the requested three to five questions. Every question says it is a practice example, and every question can be skipped.
4. **Answer** by typing or speaking. Voice uses the browser's own speech recognition, in English only (Malaysian English first, general English if that is not available). Live text shows as the user speaks with a timer and word count. If the browser ends a session early, it is restarted up to five times so a long answer is not cut off. The saved draft only changes on finished phrases and at the end, and the end of the transcript gets a capital letter, a proper "I" and a full stop. Malay and mixed-language speech are not supported. We never record or store audio. Recording state is shown, can be stopped or cancelled, and ends when the user leaves. The transcript is editable and nothing is sent until the user submits. An empty answer asks for content. If analysis fails the answer is kept and can be retried.
5. **Feedback** quotes the user's words and covers four checks (answered, own actions, concrete example, judgement) plus an AI-check when the question is about AI. Improvements are split into expression, missing example and possible skill gap. Too little information is marked uncertain. It also gives:
   - **Skill scores.** Up to four of nine skills (see Skills rubric) are rated 1 to 4 for this answer, each with a quote, a reason and one next step. Level 2 or higher needs a verified quote. Short answers are capped (under 20 words: level 2; under 40 words: level 3).
   - **Answer structure.** Situation, task, action and result, for questions about past work.
   - **A stronger version.** A rewrite in the user's voice that uses only facts already in the answer, with [brackets] for missing facts. It is dropped if it adds a number, a name, a personal topic or a hiring prediction. The user can copy it into the next draft.
   - **A follow-up question.** At most two per question. The AI's question is used only when it quotes the user's exact words, is one sentence, and adds no word or number that is not in the answer or the question. Otherwise a fixed question for the same focus (action, reason, result, obstacle, check) is used. The user can reply, say "that is not what I said", or skip.
6. **Try again** shows both full answers and compares feedback checks. The answer-history selector can reopen any saved attempt, including failed feedback. Draft changes go straight into the existing local save queue, so fast exits and question switches do not cancel a pending debounce. Skill levels for the two tries are compared when both have them. A try is practice; only the last answer for a question counts in the overview.
7. **Send a point to my resume.** The user edits their own words and sends them as a suggestion on the matching entry. The resume only changes when the user accepts it in the resume builder, where it can be undone.
8. **Skills overview.** On the start page and when a set is finished, saved answers are rolled up by skill (see Skills overview). It describes what the answers showed. It is not a test of the person and does not predict an interview. After resume practice, the finish screen also says how many points sent from this practice are waiting in the Resume builder, with a link there.
9. **Strengthen a skill.** A possible skill gap, with the question and answer that support it, can be sent to learning only after the user confirms. It opens the learning resources. Nothing is added to the plan.

## Skills rubric and overview

The rubric lives in `backend/app/services/interview_rubric.py`; the labels are mirrored in `frontend/src/features/interview/competencies.ts`. Nine skills: role know-how, problem solving, clear communication, quality and care, teamwork and leading, learning and adapting, ownership, results, and working with AI and change. Levels: 1 not shown yet, 2 started, 3 clear, 4 strong.

A bank question's `primary_intent` maps to one focus skill (for example `customer_communication` to clear communication). The focus skill is sent with the answer. Questions without an intent let the AI pick from the question text. Ownership and results can only be scored when the answer describes real past work.

The overview (`features/interview/profile.ts`) is computed in the browser from saved sessions. Nothing new is stored on the server. For each question only the last answer with feedback counts. A skill level is the rounded average across questions, shown with how many answers it rests on: one answer is a first look, two or three is early, four or more is steady. With four or more answers it also shows a trend (older half against newer half). It lists what to improve next (lowest first, with the user's own words and one next step), what the answers showed well, skills not practised yet, and skills suggested for learning.

It never judges personality, confidence, voice or accent, never gives one overall score, and never predicts hiring. Plan for what comes next: `docs/interview-practice-v2.md`.

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
| POST `/api/v1/interview/feedback` | Feedback, skill scores, stronger version and follow-up for one answer. Needs AI. The request may carry the question's `intent`. |

Both AI routes reuse the Epic 8 provider settings (no fallback chain, no cache, one correction attempt). Output checks reject personal-topic questions, assumed AI use, judgements about the person, hiring predictions, quotes that are not in the answer, skills outside the supplied list, skill scores with no verified quote, and rewrites or follow-ups that add facts. A reply that says the user has not used a tool is never counted as a weakness.

## Question bank

See `data/reference/interview/README.txt`. Load it with `db/seed_reference.py --interview-only --init`. The app's job list is ISCO-based while the bank is MASCO, so about 89 of 427 job codes have no exact match and use the family fallback.

## Known limits

- Speech recognition needs a Chromium or Safari browser; other browsers use text. Brave and other browsers that block the speech service switch back to typing with a short explanation. Live speech speed and accuracy depend on the browser's service and have not been measured here.
- Skill levels come from an AI reading of one short answer. The caps and quote checks limit over-praise, but the same answer can still score one level differently on another run. Treat levels as a guide until the test set in `docs/interview-practice-v2.md` exists.
- The follow-up word check is conservative and can fall back to a fixed question for good AI questions.
- Text guards are conservative. They are not proof that every possible AI wording is safe; live provider quality and physical microphone behaviour need separate checks.
