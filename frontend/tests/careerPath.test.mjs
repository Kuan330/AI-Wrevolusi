import test from 'node:test';
import assert from 'node:assert/strict';
import { careerPathProgress, parseChosenDirection } from '../src/features/dashboard/careerPath.ts';

const skill = (skill_id, state) => ({ skill_id, skill_slug: `s-${skill_id}`, name: `Skill ${skill_id}`, state });
const direction = skills => ({ occupation_code: '2512', title: 'Software developer', skills });

test('chosen direction is read from the Possibilities choice and ignores malformed values', () => {
  assert.deepEqual(parseChosenDirection('{"occupation_code":"2512","title":"Dev","skill_id":4}'), { occupationCode: '2512', title: 'Dev', skillId: 4 });
  assert.equal(parseChosenDirection('{"title":"Dev"}'), null);
  assert.equal(parseChosenDirection('not json'), null);
  assert.equal(parseChosenDirection(null), null);
});

test('progress counts skills already matched and lists the remaining gaps', () => {
  const result = careerPathProgress(direction([skill(1, 'have'), skill(2, 'learning'), skill(3, 'suggested'), skill(4, 'missing')]));
  assert.equal(result.percent, 50);
  assert.deepEqual(result.gaps.map(item => item.skill_id), [3, 4]);
  assert.equal(result.learning.length, 1);
});

test('next gap prefers the skill the user chose, then a shortlisted one, then the first gap', () => {
  const skills = [skill(1, 'have'), skill(2, 'missing'), skill(3, 'shortlisted'), skill(4, 'missing')];
  assert.equal(careerPathProgress(direction(skills), 4).nextGap.skill_id, 4);
  assert.equal(careerPathProgress(direction(skills), 1).nextGap.skill_id, 3);
  assert.equal(careerPathProgress(direction([skill(1, 'have'), skill(2, 'missing')])).nextGap.skill_id, 2);
});

test('a direction with no gaps or no skills has no next gap and does not divide by zero', () => {
  assert.equal(careerPathProgress(direction([skill(1, 'have')])).nextGap, null);
  assert.equal(careerPathProgress(direction([])).percent, 0);
});
