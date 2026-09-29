import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestSpecialistSkills } from '../src/pages/Skills/lib/specialistSuggestions.ts';
const skill = (label, aliases = []) => ({ uri: label, label, aliases, description: '', relation: 'essential', skill_type: 'skill/competence' });
test('specialist discovery returns exact shared source words, not an invented match', () => {
 const result = suggestSpecialistSkills('Review mechanical test results', [skill('mechanical test'), skill('review results'), skill('cost estimation')]);
 assert.equal(result.length, 2);
 assert.deepEqual(result.map(item => item.sharedWords), [['mechanical', 'test'], ['review', 'results']]);
});
test('generic work language does not create a specialist suggestion', () => {
 assert.deepEqual(suggestSpecialistSkills('perform required work tasks using skills', [skill('perform work tasks'), skill('other skills')]), []);
});
test('aliases can support a transparent match and no task gives no suggestions', () => {
 const candidates = [skill('interpret diagrams', ['read drawings'])];
 assert.deepEqual(suggestSpecialistSkills('read drawings', candidates)[0].sharedWords, ['read', 'drawings']);
 assert.deepEqual(suggestSpecialistSkills('', candidates), []);
});

test('a single shared word does not infer a specialist connection', () => {
 assert.deepEqual(suggestSpecialistSkills('Prepare mechanical estimates', [skill('mechanical assembly')]), []);
});
