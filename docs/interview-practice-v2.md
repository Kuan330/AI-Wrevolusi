# Interview practice v2: assessment and skills overview

Status: phase 1 is built on branch `kuan/interview-assessment`. Phases 2 to 9 are planned. Current behaviour is in `docs/interview-practice.md`.

## Why

Epic 9 v1 was safe but shallow. Every answer got the same four checks, the follow-up was one fixed sentence, there was no view across answers, and the link to learning almost never fired. A user could finish several sessions and still not know what to work on. The goal of v2: after a few sessions the user can see which skills their answers have shown, which they have not, and what to change next. All of it is evidence from their own words.

## Rules that do not change

- Assess answers and the skills they showed. Never judge personality, confidence, voice, accent, appearance or honesty. A transcript cannot show these reliably, and they carry bias risk.
- No single overall score. No hiring prediction. No "ready" or "not ready" label.
- Every level must rest on the user's own quoted words, and must say how many answers it rests on. Too little evidence is shown as "first look" or "not practised yet", never as a weakness.
- Not having used a tool is never a weakness.
- A rewrite or follow-up never adds a fact the user did not say.
- Practice data stays in the browser unless the user opts in to something else. Reference data only on the server.
- Plain English in every user-facing sentence.

## Phase 1: built

| Part | What it does | Where |
| --- | --- | --- |
| Skills rubric | Nine skills, levels 1 to 4, question intent to focus skill | `backend/app/services/interview_rubric.py` |
| Skill scores per answer | Up to four scores with quote, reason and next step. Quote required from level 2. Levels capped by answer length | `normalise_feedback`, `clean_scores` |
| Answer structure | Situation, task, action, result for past-work questions | `FeedbackResponse.structure` |
| Stronger version | Rewrite from the user's own facts, with [brackets] for gaps. Dropped if it adds a number or name | `safe_stronger_answer` |
| Real follow-ups | AI question kept only when its quote is verified and it adds no new word or number. Else a fixed question for its focus | `normalise_feedback` |
| Skills overview | Per-skill level, confidence, trend, lowest answers with next step, strengths, not practised, skill suggestions | `features/interview/profile.ts`, `ProfilePanel.tsx` |
| Try-again compare | Skill level changes between two tries | `compareScores` |

Known limits of phase 1: levels come from one AI reading and can move one level between runs (phase 2 measures this). Follow-up replies are saved but not assessed (phase 3). The overview mixes all roles (phase 6). Only the last 20 sessions count (phase 6). A skill suggestion does not yet link to learning from the overview (phase 5).

## Phase 2: test set and reliability (do first)

Problem: nobody has checked that the levels are fair or stable.

Build:
- 40 to 60 synthetic answers in `backend/evaluation/interview/answers.jsonl`: question, intent, answer, expected level range per skill, expected "must not" flags (invented fact, personal judgement, tool-weakness).
- Cover short, long, vague, strong, off-topic, Manglish and mixed Malay-English answers, answers that say they have not used a tool, and answers where the user did the work as a team.
- A script that runs each answer 5 times against the real provider and reports stability and agreement with the expected range.

Pass bar before levels are described as more than a guide:
- Same answer: levels within one step in at least 90% of runs.
- Expected range hit in at least 80% of answers.
- Zero runs with an invented fact in the rewrite, a personal judgement, or a skill score without a quote.
- Answers that are fair but written in simple or non-native English are not scored lower than equal-content answers in standard English.

Also record the reject rate of the follow-up word check. If more than half of good AI follow-ups fall back to fixed questions, widen the neutral word list.

## Phase 3: assess follow-up replies

Problem: the follow-up is asked and the reply is saved, but nothing uses it, so it feels like decoration.

Design:
- Add `follow_ups: [{question, answer, correction?}]` (max 2) to the feedback request, only for replies the user saved.
- The AI re-scores only the skills the follow-up targeted, using the original answer plus the reply. The reply counts as part of that question's evidence, so a good reply can lift a skill from "started" to "clear".
- "That is not what I said" removes the reply from scoring and shows the user's correction instead.
- Show "Your follow-up reply moved Results from Started to Clear" in the feedback panel.

Acceptance: a reply with a concrete result raises the result-related level in the test set; a reply that restates the first answer does not.

## Phase 4: targeted practice

Problem: the overview says what to improve, but the user must hunt for a question.

Design:
- Button on each "What you can improve next" row: **Practise this skill**.
- Plan request gets `focus_competency`. The backend picks bank questions whose intent maps to that skill (reverse of `INTENT_TO_COMPETENCY`) for the user's occupation, then family, then common. For `ai_change` it uses the AI-written question path.
- 3 questions, each a little harder: one plain "how would you", one situation with a constraint, one asking for past real work.
- Do not repeat a bank question the user already answered. Keep `askedBankIds` in the session records and skip them.
- After the set, show the skill's before and after.

Acceptance: a targeted set returns only questions for that skill, with no repeats from the last 20 sessions, and falls back to general questions with a clear note when the bank has too few.

## Phase 5: role-fit gap map and learning link

Problem: "Strengthen a skill" depends on one AI pick per answer and rarely appears.

Design:
- Map each skill to the learning skills it can send to (WEF skill ids already used by `SkillOption`). Keep the map in reference data, not in code.
- Compare the occupation's needed skills (from the chosen future occupation) with what answers have shown. A gap is flagged only when the skill has at least 3 answers and a level of 2 or less, or the same learning skill was suggested in at least 2 answers.
- Show a "Role fit" section: needed skill, what the answers showed, status (shown, not enough evidence, possible gap).
- **Strengthen** button on a gap uses the existing confirmation dialog and `startStrengthening`. Nothing is added to the learning plan without the user's confirmation.

Open question: which occupation skill list is the source of truth (ESCO or WEF)? Pick one before building.

## Phase 6: history, goals and longer memory

Problem: the 20-session cap and browser-only storage drop history, and the overview mixes roles.

Design:
- Store a compact score row per answer (skill, level, date, role, session id, no answer text) separately from sessions, so history survives deleting a session or the 20-session cap. The user can delete it too.
- Filter the overview by role and by date range.
- Goals: the user picks a skill and a level ("Clear in communication"). Show progress toward it.
- Optional: sync the compact rows to the account workspace after clear consent. Needs a privacy review first. Answer text never syncs.
- Export the overview as a printable page.

## Phase 7: session report with a written summary

Problem: finishing a set shows only the overview. A short plain summary of this session helps.

Design:
- New `POST /api/v1/interview/summary`. Input: only the rubric rows (skill, level, quote, reason), no full answers. Output: two strengths, top two things to work on, one next step, all in plain English.
- Same output checks as feedback: no personal judgement, no hiring prediction, every claim tied to a supplied quote.
- Without AI, build the summary from the same rows with fixed sentences.
- Save the summary on the session.

## Phase 8: question coverage and quality

- Balance a session across question types (past work, situation, role knowledge, motivation) and skills not yet practised.
- Add curated AI-change questions to the bank. Only 5 exist now, so the AI-at-work angle depends on the AI writing them.
- Review "Exact" bank questions that are only the job title in a template. Mark them as starters and prefer real scenario questions.
- Track which skills the bank covers per occupation, and show gaps to the content owners.

## Phase 9: language, voice and accessibility

- Accept answers in Bahasa Malaysia and mixed languages. Score the content, and show feedback in the language of the answer or in simple English. Test in phase 2 first.
- Optional speaking measures, shown only to the user: length, time taken, filler words. Label as speaking practice, no skill level. Only if the browser gives reliable data; no audio is ever stored.
- Check the overview and meters with a screen reader. Add text equivalents for the level bars. Check mobile layout.

## Order and size

| Order | Phase | Size | Depends on |
| --- | --- | --- | --- |
| 1 | 2 Test set and reliability | M | Phase 1 |
| 2 | 3 Follow-up replies | S | 2 |
| 3 | 4 Targeted practice | M | 1 |
| 4 | 5 Role-fit gap map | L | skill source decision |
| 5 | 6 History and goals | M | 1 |
| 6 | 7 Session summary | S | 1 |
| 7 | 8 Question quality | M | content owners |
| 8 | 9 Language and voice | M | 2 |

## How we will know it works

- Users who finish a set open at least one "what to improve" item and start a targeted set.
- Users who do a second set on the same skill show a higher level on average.
- Test set pass bar met (phase 2).
- No report of an invented fact or a personal judgement in feedback.
- Fewer sessions where every answer is skipped after the first feedback.

## Risks

- AI levels can drift between model versions. Re-run the test set on every provider or model change.
- Users may read a level as a verdict. Keep the "practice only, based on N answers" wording next to every level and review the copy with real users.
- Local-only storage means a cleared browser loses history. Say so near the overview until phase 6.
- The question bank is MASCO based and the app's job list is ISCO based, so about 89 of 427 jobs use the family fallback. Targeted practice will hit that more often.
