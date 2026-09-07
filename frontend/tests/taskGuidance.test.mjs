import test from 'node:test';
import assert from 'node:assert/strict';
import { taskGuidance } from '../src/pages/AIExposure/lib/taskGuidance.ts';

test('pricing and promotion intent takes precedence over incidental budgets and records', () => {
  const guidance = taskGuidance({ wording: 'Determining price lists, discount and delivery terms, sales promotion budgets, sales methods, special incentives and campaigns;' });
  assert.equal(guidance.title, 'Pricing and sales planning');
  assert.match(guidance.review, /pricing/);
  assert.equal(taskGuidance({ wording: 'Planning special marketing programmes based on sales records' }).title, 'Pricing and sales planning');
  assert.equal(taskGuidance({ wording: 'Budgeting and maintaining stock and financial records' }).title, 'Records and budgeting');
});

test('full task and working context remain in the prompt', () => {
  const wording = 'A specialist task description that is too long to fit into a compact task card title without wrapping onto many lines';
  const guidance = taskGuidance({ wording, notes: 'Use the approved internal template.' });
  assert.ok(guidance.title.length <= 80);
  assert.ok(guidance.prompt.includes(wording));
  assert.ok(guidance.prompt.includes('Use the approved internal template.'));
});
