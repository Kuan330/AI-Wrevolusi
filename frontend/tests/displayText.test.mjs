import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDisplayText, shortTaskLabel, goalDisplayLabel, taskDisplayText, taskListText } from '../src/lib/displayText.ts';

test('source entities are readable while markup remains plain text', () => {
  assert.equal(cleanDisplayText('food &amp; beverages &#x2019; &#39; &nbsp;'), "food & beverages ’ '");
  assert.equal(cleanDisplayText('&lt;script&gt;alert(1)&lt;/script&gt;'), '<script>alert(1)</script>');
  assert.equal(cleanDisplayText('A &unknown; &#xD800; &#1114112;'), 'A &unknown; &#xD800; &#1114112;');
  assert.equal(cleanDisplayText('&amp;lt;'), '&lt;');
});
test('compact labels preserve short wording and never modify the source input', () => {
  const task = 'Preparing detailed estimates of quantities and costs of materials and labour required for manufacture;';
  assert.ok(shortTaskLabel(task).length <= 80);
  assert.ok(shortTaskLabel(task).endsWith('…'));
  assert.equal(shortTaskLabel('  Check totals; '), 'Check totals');
  assert.ok(task.endsWith(';'));
  assert.equal(goalDisplayLabel('Develop Write automated software tests', 'Write automated software tests'), 'Write automated software tests');
  assert.equal(goalDisplayLabel('Developers need training'), 'Developers need training');
  assert.equal(goalDisplayLabel('Develop my confidence with reports', 'Write reports'), 'Develop my confidence with reports');
  assert.equal(goalDisplayLabel('Develop my confidence with reports'), 'Develop my confidence with reports');
});
test('task wording ends with a full stop instead of source list punctuation', () => {
  assert.equal(taskDisplayText('Creating and modifying web pages;'), 'Creating and modifying web pages.');
  assert.equal(taskDisplayText('Planning the following: '), 'Planning the following.');
  assert.equal(taskDisplayText('Checking totals ；'), 'Checking totals.');
  assert.equal(taskDisplayText('Already finished.'), 'Already finished.');
  assert.equal(taskDisplayText('Uses a; in the middle'), 'Uses a; in the middle');
  assert.equal(shortTaskLabel('Planning the following:'), 'Planning the following');
  assert.equal(taskListText(['Creating web pages;', 'Check totals', 'Done.']), 'Creating web pages. Check totals. Done.');
});
