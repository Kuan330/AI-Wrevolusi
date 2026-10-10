import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRequirementItems, buildResumeItems, prepareInterviewContext, roleTitleFromRequirements, sectionKind } from '../src/features/interview/resumeItems.ts';
import {
  addAttempt, answerFollowUp, compareAttempts, createSession, feedbackRoleTitle, followUpCount, nextOpenQuestion, questionDone, sessionProgress,
  setAttemptError, setAttemptFeedback, setDraft, skipQuestion, upsertSession, MAX_SESSIONS,
} from '../src/features/interview/session.ts';
import { parseInterviewRecord } from '../src/features/interview/repository.ts';
import { speechErrorMessage, speechSupported } from '../src/features/interview/speech.ts';
import { skillSlug } from '../src/features/interview/handoff.ts';
import { addInterviewSuggestion, applyInterviewSuggestion, dismissInterviewSuggestion, suggestionTarget } from '../src/features/resume/interviewSuggestions.ts';
import { entryLabel, reviewState, reviewedMark, resumeFingerprint } from '../src/features/resume/review.ts';
import { parseResumeRecord } from '../src/features/resume/repository.ts';
import { emptyDraft } from '../src/features/resume/types.ts';
import { ROUTES } from '../src/constants/routes.ts';
import { createInterviewStore } from '../src/infrastructure/storage/interviewStore.ts';
import { IDBFactory } from 'fake-indexeddb';

const DOCUMENT = {
  cv: {
    name: 'Aisyah Rahman', email: 'aisyah@example.test', phone: '+60 12 345 6789',
    sections: {
      Summary: ['Analyst who likes clear reports.'],
      Experience: [{ company: 'Acme Retail', position: 'Analyst', highlights: ['Prepared weekly sales reports for aisyah@example.test.'] }],
      Projects: [{ name: 'Budget tracker', highlights: ['Built a spreadsheet to track spending.'] }],
      Skills: ['Excel', 'SQL basics'],
      Education: [{ institution: 'Example University', degree: 'BSc' }],
    },
  },
};
const REQUIREMENTS = `Junior Data Analyst
Responsibilities and requirements:
- Clean and analyse data using Excel and SQL.
- Create clear charts and dashboards.
- Communicate insights clearly.`;
const feedback = (over = {}) => ({
  summary: 'Clear.', follow_up: null, skill_gap: null, improvements: [],
  checks: [{ id: 'answered_question', status: 'partly', quote: null, note: '' }, { id: 'own_actions', status: 'no', quote: null, note: '' }, { id: 'concrete_example', status: 'yes', quote: null, note: '' }, { id: 'judgement', status: 'not_applicable', quote: null, note: '' }],
  ...over,
});
const plan = (items) => ({ source: 'ai', questions: items.map(([text, item_id]) => ({ text, kind: item_id ? 'resume_item' : 'general', item_id, topic_id: null, bank_id: null })) });
function session() {
  const items = buildResumeItems(DOCUMENT);
  return createSession({ mode: 'resume', role: { title: 'Junior Data Analyst', requirements: REQUIREMENTS }, resumeVersion: { reviewedAt: '2026-10-07T00:00:00.000Z', itemCount: items.length }, items, plan: plan([['What did you do?', items[1].id], ['Tell me about the tracker.', items[2].id], ['Practice one?', null]]) });
}

test('only work, project, skill and summary chapters become items, with entry references', () => {
  const items = buildResumeItems(DOCUMENT);
  assert.deepEqual(items.map(item => item.kind), ['summary', 'work', 'project', 'skill', 'skill']);
  assert.deepEqual(items.map(item => item.label), ['Analyst who likes clear reports.', 'Analyst, Acme Retail', 'Budget tracker', 'Excel', 'SQL basics']);
  assert.deepEqual(items[1].ref, { section: 'Experience', index: 0 });
  assert.equal(items[3].text, '', 'a skill name alone is not evidence of use');
  assert.ok(!items.some(item => /University/.test(item.label)), 'education is not asked about');
  assert.equal(sectionKind('Professional Experience'), 'work');
  assert.equal(sectionKind('Awards'), null);
});

test('requirement lines become practice topics and the first line is the role', () => {
  assert.equal(roleTitleFromRequirements(REQUIREMENTS), 'Junior Data Analyst');
  assert.equal(roleTitleFromRequirements(''), 'Target role');
  assert.deepEqual(buildRequirementItems(REQUIREMENTS).map(item => item.label), ['Clean and analyse data using Excel and SQL.', 'Create clear charts and dashboards.', 'Communicate insights clearly.']);
  assert.ok(buildRequirementItems(REQUIREMENTS).every(item => item.kind === 'requirement' && item.text === ''));
});

test('what AI receives hides contact details and private words, and questions restore them locally', () => {
  const context = prepareInterviewContext(DOCUMENT, REQUIREMENTS, 'Acme Retail');
  const sent = JSON.stringify(context.sent);
  assert.ok(!sent.includes('aisyah@example.test') && !sent.includes('Acme Retail'));
  assert.deepEqual(context.sent.map(item => item.id), context.display.map(item => item.id), 'ids line up');
  const token = context.sent.find(item => item.kind === 'work').label.match(/\[PRIVATE_\d+\]/)[0];
  assert.equal(context.restore(`How did you work at ${token}?`), 'How did you work at Acme Retail?');
  assert.ok(context.display.find(item => item.kind === 'work').label.includes('Acme Retail'), 'the user still sees real names');
});

test('a session keeps what the user reads and the redacted wording separately', () => {
  const items = buildResumeItems(DOCUMENT);
  const made = createSession({ mode: 'resume', role: { title: 'R', requirements: '' }, resumeVersion: null, items, plan: plan([['Ask about [PRIVATE_1].', items[1].id]]), restore: value => value.replace('[PRIVATE_1]', 'Acme') });
  assert.equal(made.questions[0].text, 'Ask about Acme.');
  assert.equal(made.questions[0].sentText, 'Ask about [PRIVATE_1].');
  assert.equal(made.questions[0].itemLabel, 'Analyst, Acme Retail');
  assert.throws(() => createSession({ mode: 'general', role: { title: 'R', requirements: '' }, resumeVersion: null, items: [], plan: { source: 'template', questions: [] } }), /No practice questions/);
});

test('empty answers are refused, skipped questions can be reopened and progress counts honestly', () => {
  let s = session();
  const [a, b, c] = s.questions.map(question => question.id);
  assert.throws(() => addAttempt(s, a, { answer: '   ', mode: 'text' }), /Add your answer first/);
  assert.deepEqual(sessionProgress(s), { total: 3, answered: 0, skipped: 0, remaining: 3, complete: false });
  let attemptId;
  ({ session: s, attemptId } = addAttempt(s, a, { answer: 'I wrote the report myself.', mode: 'voice' }));
  assert.equal(questionDone(s.questions[0]), false, 'an answer without feedback is not finished');
  s = setAttemptFeedback(s, a, attemptId, feedback());
  s = skipQuestion(s, b);
  assert.deepEqual(sessionProgress(s), { total: 3, answered: 1, skipped: 1, remaining: 1, complete: false });
  assert.equal(nextOpenQuestion(s), 2);
  assert.equal(nextOpenQuestion(s, 2), 2, 'wraps around to the open question');
  s = skipQuestion(s, c);
  assert.equal(sessionProgress(s).complete, true);
  assert.equal(nextOpenQuestion(s), -1);
});

test('a failed analysis keeps the answer, and a draft is kept until it is submitted', () => {
  let s = session();
  const id = s.questions[0].id;
  s = setDraft(s, id, 'half an answer');
  assert.equal(s.questions[0].draft, 'half an answer');
  let attemptId;
  ({ session: s, attemptId } = addAttempt(s, id, { answer: 'half an answer', mode: 'text' }));
  assert.equal(s.questions[0].draft, '');
  s = setAttemptError(s, id, attemptId, 'Feedback could not be prepared.');
  assert.equal(s.questions[0].attempts[0].answer, 'half an answer');
  assert.equal(s.questions[0].attempts[0].error, 'Feedback could not be prepared.');
  s = setAttemptFeedback(s, id, attemptId, feedback());
  assert.equal(s.questions[0].attempts[0].error, '');
});

test('each question gets at most two follow-up questions across all attempts', () => {
  let s = session();
  const id = s.questions[0].id;
  const ask = (text) => { let attemptId; ({ session: s, attemptId } = addAttempt(s, id, { answer: 'again', mode: 'text' })); s = setAttemptFeedback(s, id, attemptId, feedback({ follow_up: text })); return attemptId; };
  const first = ask('What did you change?');
  ask('Who used it?');
  ask('A third one?');
  assert.equal(followUpCount(s.questions[0]), 2);
  assert.equal(s.questions[0].attempts[2].followUps.length, 0);
  const followUpId = s.questions[0].attempts[0].followUps[0].id;
  s = answerFollowUp(s, id, first, followUpId, { answer: ' The totals. ' });
  assert.equal(s.questions[0].attempts[0].followUps[0].answer, 'The totals.');
  s = answerFollowUp(s, id, first, followUpId, { correction: 'I did not say that' });
  assert.equal(s.questions[0].attempts[0].followUps[0].correction, 'I did not say that');
  s = answerFollowUp(s, id, first, followUpId, { skipped: true });
  assert.equal(s.questions[0].attempts[0].followUps[0].skipped, true);
});

test('comparing two attempts shows covered points and never scores competence', () => {
  let s = session();
  const id = s.questions[0].id;
  let one, two;
  ({ session: s, attemptId: one } = addAttempt(s, id, { answer: 'first', mode: 'text' }));
  s = setAttemptFeedback(s, id, one, feedback());
  ({ session: s, attemptId: two } = addAttempt(s, id, { answer: 'second', mode: 'text' }));
  s = setAttemptFeedback(s, id, two, feedback({ checks: [{ id: 'answered_question', status: 'yes', quote: null, note: '' }, { id: 'own_actions', status: 'no', quote: null, note: '' }, { id: 'concrete_example', status: 'partly', quote: null, note: '' }, { id: 'judgement', status: 'yes', quote: null, note: '' }] }));
  const [x, y] = s.questions[0].attempts;
  const result = compareAttempts(x, y);
  assert.deepEqual(result.changes.map(change => [change.id, change.result]), [['answered_question', 'better'], ['own_actions', 'same'], ['concrete_example', 'worse']], 'not-applicable checks are left out');
  assert.deepEqual(result.addressed.map(change => change.id), ['answered_question']);
  assert.deepEqual(result.stillOpen.map(change => change.id), ['own_actions', 'concrete_example']);
  assert.equal(compareAttempts({ ...x, feedback: null }, y), null);
});

test('sessions are listed newest first and capped', () => {
  let list = [];
  for (let n = 0; n < MAX_SESSIONS + 3; n++) { const made = session(); made.updatedAt = new Date(2026, 0, n + 1).toISOString(); list = upsertSession(list, made); }
  assert.equal(list.length, MAX_SESSIONS);
  assert.ok(list[0].updatedAt > list.at(-1).updatedAt);
  const again = { ...list[3], updatedAt: '2030-01-01T00:00:00.000Z' };
  assert.equal(upsertSession(list, again)[0].id, again.id);
  assert.equal(upsertSession(list, again).length, MAX_SESSIONS);
});

test('saved practice is read strictly and never silently replaced', () => {
  const owner = 'user-1';
  assert.deepEqual(parseInterviewRecord(null, owner).sessions, []);
  const good = { version: 1, owner, revision: 2, sessions: [session()] };
  assert.equal(parseInterviewRecord(good, owner).sessions.length, 1);
  assert.throws(() => parseInterviewRecord(good, 'someone-else'), /could not be read/);
  assert.throws(() => parseInterviewRecord({ ...good, sessions: [{ ...good.sessions[0], questions: [{ id: 1 }] }] }, owner), /could not be read/);
  assert.throws(() => parseInterviewRecord({ ...good, sessions: 'x' }, owner), /could not be read/);
});

test('feedback uses the redacted role snapshot and omits unsafe legacy titles', () => {
  const s = session();
  s.role.title = 'Private Aurora Analytics Junior Data Analyst';
  s.role.sentTitle = '[PRIVATE_1] Junior Data Analyst';
  assert.equal(feedbackRoleTitle(s), '[PRIVATE_1] Junior Data Analyst');
  delete s.role.sentTitle;
  assert.equal(feedbackRoleTitle(s), '', 'legacy saved titles must not restore hidden words in requests');
  s.role.sentTitle = 'x'.repeat(250);
  assert.equal(feedbackRoleTitle(s).length, 200);
});

test('occupation practice snapshots survive storage and malformed optional fields are refused', () => {
  const s = session();
  s.mode = 'career'; s.resumeVersion = null;
  s.role = { title: 'Future analyst', requirements: 'Explain reports', sentTitle: 'Future analyst', occupationCode: 'TEST-01' };
  const record = { version: 1, owner: 'u', revision: 1, sessions: [s] };
  const restored = parseInterviewRecord(JSON.parse(JSON.stringify(record)), 'u').sessions[0];
  assert.equal(restored.mode, 'career');
  assert.equal(restored.role.occupationCode, 'TEST-01');
  assert.equal(restored.resumeVersion, null);
  for (const field of ['sentTitle', 'occupationCode']) {
    const malformed = structuredClone(record); malformed.sessions[0].role[field] = 4;
    assert.throws(() => parseInterviewRecord(malformed, 'u'), /could not be read/);
  }
});

test('immediate draft snapshots preserve fast edits on different questions in queued storage', async () => {
  const store = createInterviewStore(new IDBFactory());
  let s = session(), revision = 0, queue = Promise.resolve();
  const [first, second] = s.questions.map(question => question.id);
  const save = next => { queue = queue.then(() => store.update('u', () => ({ version: 1, owner: 'u', revision: ++revision, sessions: [next] }))); };
  s = setDraft(s, first, 'first question draft'); save(s);
  s = setDraft(s, second, 'second question draft'); save(s);
  s = setDraft(s, first, 'first question final draft'); save(s);
  await queue;
  const restored = parseInterviewRecord(await store.read('u'), 'u').sessions[0];
  assert.equal(restored.questions[0].draft, 'first question final draft');
  assert.equal(restored.questions[1].draft, 'second question draft');
  assert.equal(revision, 3);
});

test('all attempts remain reviewable and a reply updates only its chosen historical attempt', () => {
  let s = session();
  const questionId = s.questions[0].id, ids = [];
  for (const answer of ['first full answer', 'failed full answer', 'latest full answer']) {
    let attemptId; ({ session: s, attemptId } = addAttempt(s, questionId, { answer, mode: 'text' })); ids.push(attemptId);
    s = answer.startsWith('failed') ? setAttemptError(s, questionId, attemptId, 'Try again') : setAttemptFeedback(s, questionId, attemptId, feedback({ follow_up: 'What did you do?' }));
  }
  const record = { version: 1, owner: 'u', revision: 1, sessions: [s] };
  s = parseInterviewRecord(JSON.parse(JSON.stringify(record)), 'u').sessions[0];
  assert.deepEqual(s.questions[0].attempts.map(attempt => attempt.answer), ['first full answer', 'failed full answer', 'latest full answer']);
  const first = s.questions[0].attempts[0];
  s = answerFollowUp(s, questionId, ids[0], first.followUps[0].id, { answer: 'Historical reply' });
  assert.equal(s.questions[0].attempts[0].followUps[0].answer, 'Historical reply');
  assert.equal(s.questions[0].attempts[1].error, 'Try again');
  assert.equal(s.questions[0].attempts[2].followUps[0].answer, null);
});

test('voice support is detected without recording anything, with plain messages when it fails', () => {
  assert.equal(speechSupported({}), false);
  assert.equal(speechSupported({ webkitSpeechRecognition: function () {} }), true);
  assert.match(speechErrorMessage('not-allowed'), /type your answer/);
  assert.match(speechErrorMessage('something-new'), /type your answer/);
});

test('skill slugs match the backend rule', () => {
  assert.equal(skillSlug('Service orientation and customer service'), 'service-orientation-and-customer-service');
  assert.equal(skillSlug('  AI & Big Data!  '), 'ai-big-data');
});

test('the resume is marked reviewed for a version, and any change needs a new review', () => {
  const draft = { ...emptyDraft('u'), document: structuredClone(DOCUMENT), jobRequirements: REQUIREMENTS };
  assert.equal(reviewState(emptyDraft('u')).status, 'missing');
  assert.equal(reviewState(draft).status, 'needs-review');
  const reviewed = { ...draft, reviewed: reviewedMark(draft, new Date('2026-10-07T01:00:00Z')) };
  assert.deepEqual(reviewState(reviewed), { status: 'reviewed', at: '2026-10-07T01:00:00.000Z' });
  const personal = structuredClone(reviewed); personal.document.cv.email = 'new@example.test';
  assert.equal(reviewState(personal).status, 'reviewed', 'contact details are not part of the reviewed content');
  const edited = structuredClone(reviewed); edited.document.cv.sections.Skills.push('Python');
  assert.equal(reviewState(edited).status, 'needs-review');
  assert.equal(reviewState({ ...reviewed, jobRequirements: 'Another role' }).status, 'needs-review');
  assert.equal(resumeFingerprint(draft), resumeFingerprint(structuredClone(draft)));
  assert.equal(entryLabel({ company: 'Acme', position: 'Analyst' }), 'Analyst, Acme');
  assert.equal(entryLabel({ bullet: 'x'.repeat(200) }).length, 80);
});

const suggestion = (over = {}) => ({ id: 's1', sessionId: 'x', createdAt: '2026-10-07T00:00:00.000Z', section: 'Experience', entryIndex: 0, entryLabel: 'Analyst, Acme Retail', text: ' Checked totals against till records. ', question: 'q', ...over });
test('a practice point is only a suggestion until accepted, then it is added in the user’s own words', () => {
  const draft = { ...emptyDraft('u'), document: structuredClone(DOCUMENT) };
  const offered = addInterviewSuggestion(draft, suggestion());
  assert.deepEqual(offered.document, DOCUMENT, 'offering changes nothing');
  assert.equal(offered.interviewSuggestions[0].text, 'Checked totals against till records.');
  assert.equal(addInterviewSuggestion(offered, suggestion({ text: 'Changed.' })).interviewSuggestions.length, 1, 'same id replaces');
  assert.throws(() => addInterviewSuggestion(draft, suggestion({ text: '  ' })), /Write the point/);
  const accepted = applyInterviewSuggestion(DOCUMENT, suggestion());
  assert.deepEqual(accepted.cv.sections.Experience[0].highlights.at(-1), 'Checked totals against till records.');
  assert.equal(accepted.cv.sections.Experience[0].highlights.length, 2);
  assert.equal(DOCUMENT.cv.sections.Experience[0].highlights.length, 1, 'the original document is not mutated');
  assert.deepEqual(dismissInterviewSuggestion(offered, 's1').interviewSuggestions, []);
});

test('a suggestion for an entry that changed is refused instead of landing on the wrong entry', () => {
  const moved = structuredClone(DOCUMENT); moved.cv.sections.Experience[0].position = 'Senior Analyst';
  assert.equal(suggestionTarget(moved, suggestion()), null);
  assert.throws(() => applyInterviewSuggestion(moved, suggestion()), /has changed/);
  assert.throws(() => applyInterviewSuggestion(DOCUMENT, suggestion({ section: 'Missing' })), /has changed/);
});

test('suggestions fit bullet, text and label entries without breaking the chapter shape', () => {
  const doc = { cv: { sections: { Skills: ['Excel'], Notes: [{ bullet: 'Kept records' }], Misc: [{ label: 'Languages', details: 'English' }] } } };
  assert.deepEqual(applyInterviewSuggestion(doc, suggestion({ section: 'Skills', entryLabel: 'Excel', text: 'Used Excel for reports' })).cv.sections.Skills, ['Excel', 'Used Excel for reports']);
  assert.deepEqual(applyInterviewSuggestion(doc, suggestion({ section: 'Notes', entryLabel: 'Kept records', text: 'Checked them weekly' })).cv.sections.Notes, [{ bullet: 'Kept records' }, { bullet: 'Checked them weekly' }]);
  assert.equal(applyInterviewSuggestion(doc, suggestion({ section: 'Misc', entryLabel: 'Languages', text: 'and Malay' })).cv.sections.Misc[0].details, 'English and Malay');
});

test('saved resume records accept the new optional fields and reject broken ones', () => {
  const base = { ...emptyDraft('u'), revision: 1, updatedAt: 'now' };
  const withNew = { ...base, reviewed: { at: 'x', fingerprint: 'y' }, interviewSuggestions: [suggestion()] };
  assert.equal(parseResumeRecord(withNew, 'u').interviewSuggestions.length, 1);
  assert.equal(parseResumeRecord(base, 'u').reviewed, undefined, 'older records still open');
  assert.throws(() => parseResumeRecord({ ...base, reviewed: { at: 1 } }, 'u'), /could not be read/);
  assert.throws(() => parseResumeRecord({ ...base, interviewSuggestions: [{ id: 1 }] }, 'u'), /could not be read/);
});

test('the interview page has its own route', () => {
  assert.equal(ROUTES.interview, '/career/possibilities/interview');
});
