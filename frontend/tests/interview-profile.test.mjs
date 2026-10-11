import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProfile, compareScores, weakestEvidence } from '../src/features/interview/profile.ts';
import { addAttempt, createSession, setAttemptFeedback } from '../src/features/interview/session.ts';

const plan = { source: 'template', questions: [
  { text: 'Q1?', kind: 'general', item_id: null, topic_id: null, bank_id: 'B1' },
  { text: 'Q2?', kind: 'general', item_id: null, topic_id: null, bank_id: null },
] };
const score = (competency, level, over = {}) => ({ competency, level, quote: 'I checked it', reason: 'You named a check.', next_step: 'Add a result.', ...over });
const feedback = (scores, over = {}) => ({ summary: 'ok', checks: [], improvements: [], follow_up: null, skill_gap: null, scores, ...over });

function answered(levels, now = new Date('2026-10-01T00:00:00Z')) {
  let session = createSession({ mode: 'general', role: { title: 'General practice', requirements: '' }, resumeVersion: null, items: [], plan, now, bankIntents: { B1: 'customer_communication' } });
  levels.forEach((scores, index) => {
    if (!scores) return;
    const id = session.questions[index].id;
    const { session: next, attemptId } = addAttempt(session, id, { answer: 'I checked it and fixed it.', mode: 'text' });
    session = setAttemptFeedback(next, id, attemptId, feedback(scores));
  });
  return session;
}

test('a bank question keeps its intent so feedback knows what it tests', () => {
  const session = answered([]);
  assert.equal(session.questions[0].intent, 'customer_communication');
  assert.equal(session.questions[1].intent, null);
});

test('no scored answers gives an empty overview', () => {
  const profile = buildProfile([answered([null, null])]);
  assert.equal(profile.answers, 0);
  assert.equal(profile.notYet.length, 9);
  assert.deepEqual(profile.strengths, []);
});

test('one answer is a first look and levels are the rounded average', () => {
  const profile = buildProfile([answered([[score('communication', 3), score('results', 1)], [score('communication', 2)]])]);
  const communication = profile.rows.find(row => row.id === 'communication');
  assert.equal(communication.evidence.length, 2);
  assert.equal(communication.level, 3);
  assert.equal(communication.confidence, 'early');
  assert.equal(profile.rows.find(row => row.id === 'results').confidence, 'first_look');
  assert.deepEqual(profile.improve.map(row => row.id), ['results']);
  assert.deepEqual(profile.strengths.map(row => row.id), ['communication']);
  assert.equal(profile.notYet.length, 7);
});

test('only the last answer for a question counts, so retrying replaces the old score', () => {
  let session = answered([[score('communication', 1)]]);
  const id = session.questions[0].id;
  const { session: next, attemptId } = addAttempt(session, id, { answer: 'A better answer with more detail.', mode: 'text' });
  session = setAttemptFeedback(next, id, attemptId, feedback([score('communication', 3)]));
  const row = buildProfile([session]).rows.find(item => item.id === 'communication');
  assert.equal(row.evidence.length, 1);
  assert.equal(row.level, 3);
});

test('a trend needs four answers and compares the older half with the newer half', () => {
  const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
  const sessions = days.map((day, index) => answered([[score('quality_care', index < 2 ? 1 : 3)]], new Date(`${day}T00:00:00Z`)));
  assert.equal(buildProfile(sessions.slice(0, 3)).rows.find(row => row.id === 'quality_care').trend, null);
  const row = buildProfile(sessions).rows.find(item => item.id === 'quality_care');
  assert.equal(row.confidence, 'steady');
  assert.equal(row.trend, 'up');
});

test('skipped questions add no evidence', () => {
  assert.equal(buildProfile([answered([null, [score('results', 2)]])]).answers, 1);
});

test('skill suggestions are counted and the weakest answers come first', () => {
  const gap = { skill_id: 3, reason: 'Analysis' };
  const session = answered([[score('problem_solving', 3)], [score('problem_solving', 1)]]);
  const withGap = buildProfile([answered([[score('problem_solving', 2)]]), session]);
  assert.equal(weakestEvidence(withGap.rows.find(row => row.id === 'problem_solving'), 1)[0].level, 1);
  let one = answered([null, null]);
  const id = one.questions[0].id;
  const { session: next, attemptId } = addAttempt(one, id, { answer: 'I did reports for the team.', mode: 'text' });
  one = setAttemptFeedback(next, id, attemptId, feedback([], { skill_gap: gap }));
  assert.deepEqual(buildProfile([one]).gaps, [{ skillId: 3, count: 1, reason: 'Analysis' }]);
});

test('feedback saved before the rubric still builds an overview', () => {
  const old = answered([[]]);
  old.questions[0].attempts[0].feedback = { summary: 'ok', checks: [], improvements: [], follow_up: null, skill_gap: null };
  assert.equal(buildProfile([old]).answers, 1);
  assert.deepEqual(compareScores(undefined, [score('results', 2)]), []);
});

test('compare shows the change only for skills scored in both tries', () => {
  assert.deepEqual(compareScores([score('results', 1), score('learning', 2)], [score('results', 3)]), [{ competency: 'results', before: 1, after: 3 }]);
});
