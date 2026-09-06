import test from 'node:test';
import assert from 'node:assert/strict';
import { IloOccupationExposure, ILO_OCCUPATION_EXPOSURES, parseIloOccupationExposure, referenceOccupationCategory, countOccupationCategories } from '../src/pages/Analysis/lib/iloExposure.ts';

test('accepts exactly the six published ILO occupation categories', () => {
  assert.deepEqual(Object.values(IloOccupationExposure), [
    'Not Exposed', 'Minimal Exposure', 'Exposed: Gradient 1',
    'Exposed: Gradient 2', 'Exposed: Gradient 3', 'Exposed: Gradient 4',
  ]);
  for (const {value} of ILO_OCCUPATION_EXPOSURES) assert.equal(parseIloOccupationExposure(value), value);
  for (const value of [null, undefined, '', 'AI-Enhanced', 'Reshaped', 'Partly automated']) {
    assert.equal(parseIloOccupationExposure(value), null);
  }
});

test('does not convert an individual score into an occupational gradient', () => {
  for (const adjusted_score of [0, 0.26, 0.4, 0.59, 1]) {
    const task = {potential25: 'Exposed: Gradient 2', adjusted_score};
    assert.equal(referenceOccupationCategory(task), 'Exposed: Gradient 2');
    assert.equal(referenceOccupationCategory({}, {potential25: null, adjusted_score}), null);
  }
});

test('all six filter counts equal their matching rows, with missing data in total only', () => {
  const tasks = ILO_OCCUPATION_EXPOSURES.flatMap(({value}, index) => [
    {id: `${index}-a`, potential25: value}, {id: `${index}-b`, potential25: value},
  ]);
  tasks.push({id: 'missing', potential25: null}, {id: 'old', potential25: 'AI-Enhanced'});
  const assessments = new Map([
    ['0-a', {potential25: 'Exposed: Gradient 4'}],
    ['1-a', {potential25: 'unknown legacy value'}],
  ]);
  const result = countOccupationCategories(tasks, assessments);
  assert.equal(result.total, 14);
  assert.equal(result.unclassified, 2);
  assert.equal(result.counts['Exposed: Gradient 4'], 3);
  assert.equal(result.counts['Not Exposed'], 1);
  for (const {value} of ILO_OCCUPATION_EXPOSURES) {
    const matching = tasks.filter(task => referenceOccupationCategory(task, assessments.get(task.id)) === value);
    assert.equal(result.counts[value], matching.length);
  }
  assert.equal(Object.values(result.counts).reduce((a,b) => a+b, 0) + result.unclassified, result.total);
});
