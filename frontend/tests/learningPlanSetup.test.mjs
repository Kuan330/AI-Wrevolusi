import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlanResource, normalizeResourceUrl, setupInputs, validateSetupDraft, validateResourceFile, validateResourceText, MAX_RESOURCE_BYTES, MAX_TOTAL_RESOURCE_TEXT } from '../src/features/learning-goals/learningPlanSetup.ts';

const draft = (overrides = {}) => ({ goalText: '  Learn AI for my work  ', experience: 'new', minutesPerDay: 30, goalKind: '', ...overrides });
const file = (overrides = {}) => ({ id: 'f1', kind: 'file', name: 'notes.md', text: '# My notes', sizeBytes: 10, ...overrides });
const link = (overrides = {}) => ({ id: 'l1', kind: 'link', name: 'Reference', url: 'https://example.com/lesson', ...overrides });

test('starting level and time require an explicit choice', () => {
  assert.match(validateSetupDraft(draft({ experience: '' })), /starting level/);
  assert.match(validateSetupDraft(draft({ minutesPerDay: '' })), /each day/);
  assert.throws(() => setupInputs(draft({ experience: 'expert' })), /starting level/);
  assert.throws(() => setupInputs(draft({ minutesPerDay: 10 })), /each day/);
});
test('goal validation trims text and enforces length', () => {
  assert.match(validateSetupDraft(draft({ goalText: '   ' })), /what you want/);
  assert.match(validateSetupDraft(draft({ goalText: 'x'.repeat(301) })), /300/);
  assert.equal(setupInputs(draft()).goalText, 'Learn AI for my work');
});
test('optional motivation uses existing plan contract without inventing an enum', () => {
  assert.equal(setupInputs(draft()).goalKind, 'curiosity');
  for (const goalKind of ['career', 'skill', 'confidence', 'curiosity']) assert.equal(setupInputs(draft({ goalKind })).goalKind, goalKind);
  assert.throws(() => setupInputs(draft({ goalKind: 'business' })), /supported reason/);
});
test('previous 45 and 90 minute plans remain editable', () => {
  for (const minutesPerDay of [15, 30, 45, 60, 90]) assert.equal(setupInputs(draft({ minutesPerDay })).minutesPerDay, minutesPerDay);
});
test('link validation rejects unsafe protocols and embedded credentials', () => {
  for (const url of ['', 'not a url', 'javascript:alert(1)', 'data:text/plain,hi', 'file:///tmp/a', 'https://user:password@example.com', 'https://example.com/' + 'a'.repeat(2048)]) assert.throws(() => normalizeResourceUrl(url));
  assert.equal(normalizeResourceUrl(' https://EXAMPLE.com/lesson#section '), 'https://example.com/lesson');
  assert.equal(normalizeResourceUrl('http://example.com'), 'http://example.com/');
});
test('references are added immutably and duplicate links are rejected', () => {
  const original = [];
  const next = addPlanResource(original, link());
  assert.equal(original.length, 0);
  assert.equal(next[0].name, 'example.com');
  assert.throws(() => addPlanResource(next, link({ id: 'l2', url: 'https://EXAMPLE.com/lesson#part' })), /already attached/);
});
test('text attachments accept supported files and reject empty, oversized and binary files', () => {
  for (const name of ['notes.txt', 'notes.MD', 'notes.csv']) assert.equal(validateResourceFile({ name, size: 10 }), '');
  assert.match(validateResourceFile({ name: 'notes.pdf', size: 10 }), /not supported/);
  assert.match(validateResourceFile({ name: 'notes.txt', size: 0 }), /empty/);
  assert.match(validateResourceFile({ name: 'notes.txt', size: MAX_RESOURCE_BYTES + 1 }), /1 MB/);
  assert.match(validateResourceText(' '), /no readable text/);
  assert.match(validateResourceText('abc\u0000def'), /UTF-8/);
  assert.match(validateResourceText('abc\uFFFDdef'), /UTF-8/);
  assert.match(validateResourceText('a'.repeat(20_001)), /20,000/);
});
test('resource limits and duplicate files do not alter existing references', () => {
  const existing = addPlanResource([], file());
  assert.throws(() => addPlanResource(existing, file({ id: 'f2' })), /already attached/);
  assert.throws(() => addPlanResource(Array.from({ length: 5 }, (_, index) => link({ id: String(index) })), file()), /up to 5/);
  assert.equal(existing.length, 1);
  const full = [file({ text: 'a'.repeat(20_000) }), file({ id: 'f2', text: 'b'.repeat(20_000) })];
  assert.throws(() => addPlanResource(full, file({ id: 'f3', text: 'c'.repeat(MAX_TOTAL_RESOURCE_TEXT - 40_000 + 1) })), /50,000/);
});
test('adding a file preserves actual text, not just an upload label', () => {
  const resource = addPlanResource([], file())[0];
  assert.equal(resource.text, '# My notes');
  assert.equal(resource.sizeBytes, 10);
  assert.throws(() => addPlanResource([], file({ text: '' })), /no readable text/);
  assert.throws(() => addPlanResource([], file({ kind: 'unknown' })), /not supported/);
});
