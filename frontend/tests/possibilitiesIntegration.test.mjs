import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  possibilitiesViewState,
  shouldApplyPossibilitiesResult,
} from '../src/pages/Possibilities/possibilitiesModel.ts';

import * as model from '../src/pages/Possibilities/possibilitiesModel.ts';

test('work profile destination restores an existing occupation workspace', () => {
  assert.equal(typeof model.possibilitiesProfilePath, 'function');
  assert.equal(model.possibilitiesProfilePath({ tasksOccupationCode: '2512' }), '/profile/tasks');
  for (const workspace of [null, undefined, {}, { tasksOccupationCode: '' }]) {
    assert.equal(model.possibilitiesProfilePath(workspace), '/profile');
  }
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('loading waits for workspace save before GET and publishes the real response', async () => {
  assert.equal(typeof model.loadSavedPossibilities, 'function');
  const save = deferred();
  const events = [];
  const controller = new AbortController();
  const result = { status: 'needs_profile' };
  const loading = model.loadSavedPossibilities({
    signal: controller.signal,
    flush: () => { events.push('save'); return save.promise; },
    get: async signal => { assert.equal(signal, controller.signal); events.push('get'); return result; },
    onSuccess: value => { assert.equal(value, result); events.push('publish'); },
    onError: () => assert.fail('unexpected error'),
  });
  assert.deepEqual(events, ['save']);
  save.resolve();
  await loading;
  assert.deepEqual(events, ['save', 'get', 'publish']);
});

test('a save conflict does not block loading the saved Possibilities response', async () => {
  const saveFailure = new Error('Your account changed in another session.');
  const result = { status: 'ready' };
  const events = [];

  await model.loadSavedPossibilities({
    signal: new AbortController().signal,
    flush: async () => { events.push('save'); throw saveFailure; },
    get: async () => { events.push('get'); return result; },
    onSuccess: value => { assert.equal(value, result); events.push('publish'); },
    onError: () => assert.fail('the read should remain available'),
  });

  assert.deepEqual(events, ['save', 'get', 'publish']);
});

test('a failed Possibilities GET is still delivered intact', async () => {
  const failure = new Error('get failed');
  const events = [];

  await model.loadSavedPossibilities({
    signal: new AbortController().signal,
    flush: async () => { events.push('save'); },
    get: async () => { events.push('get'); throw failure; },
    onSuccess: () => assert.fail('must not publish data'),
    onError: error => { assert.equal(error, failure); events.push('error'); },
  });

  assert.deepEqual(events, ['save', 'get', 'error']);
});

test('cancellation prevents requests and ignores late save or GET outcomes', async () => {
  for (const stage of ['before', 'save', 'get']) {
    for (const rejects of [false, true]) {
      const controller = new AbortController();
      const pending = deferred();
      const events = [];
      if (stage === 'before') controller.abort();
      const loading = model.loadSavedPossibilities({
        signal: controller.signal,
        flush: () => { events.push('save'); return stage === 'save' ? pending.promise : Promise.resolve(); },
        get: () => { events.push('get'); return pending.promise; },
        onSuccess: () => events.push('publish'),
        onError: () => events.push('error'),
      });
      await Promise.resolve();
      controller.abort();
      if (stage !== 'before') {
        if (rejects) pending.reject(new Error('late failure'));
        else pending.resolve({ status: 'ready' });
      } else pending.resolve({ status: 'ready' });
      await loading;
      assert.deepEqual(events, stage === 'before' ? [] : stage === 'save' ? ['save'] : ['save', 'get']);
    }
  }
});

const ready = {
  contract_version: '1',
  score_semantics: 'direction_skill_coverage',
  disclaimer: 'Exploratory skill connections only; not job readiness or hiring probability.',
  source: 'live',
  status: 'ready',
  current_role: { occupation_code: '2512', title: 'Software developers' },
  current_role_coverage_pct: 50,
  skills: [],
  directions: [],
  chosen_direction_code: null,
  shortlisted_skill_ids: [],
};

test('maps explicit backend states without inventing data', () => {
  assert.equal(possibilitiesViewState({ loading: true, error: '', data: null }), 'loading');
  assert.equal(possibilitiesViewState({ loading: false, error: 'offline', data: null }), 'error');
  assert.equal(
    possibilitiesViewState({ loading: false, error: '', data: { ...ready, status: 'needs_profile' } }),
    'needs-profile',
  );
  assert.equal(possibilitiesViewState({ loading: false, error: '', data: ready }), 'ready');
});

test('ignores stale or post-unmount responses', () => {
  assert.equal(shouldApplyPossibilitiesResult(2, 2, true), true);
  assert.equal(shouldApplyPossibilitiesResult(1, 2, true), false);
  assert.equal(shouldApplyPossibilitiesResult(2, 2, false), false);
});

test('typed service uses only the proposed endpoints and shared api wrapper', () => {
  const service = readFileSync(
    new URL('../src/services/possibilitiesService.ts', import.meta.url),
    'utf8',
  );
  assert.match(service, /from "@\/services\/api"/);
  assert.match(service, /api\.get<PossibilitiesResponse>\("\/possibilities"/);
  assert.match(service, /api\.get<PossibilitiesResponse>\("\/possibilities"/);
  assert.doesNotMatch(service, /api\.put/);
  assert.doesNotMatch(service, /sessionStorage/);
});

test('live response maps backend scores and skills without recomputing them', () => {
  const model = readFileSync(new URL('../src/pages/Possibilities/possibilitiesModel.ts', import.meta.url), 'utf8');
  assert.match(model, /toPossibilitiesData/);
  assert.match(model, /coverage_pct/);
  assert.doesNotMatch(model, /directionMatch/);
});

test('page loads live data, restores and persists approved workspace keys', () => {
  const page = readFileSync(new URL('../src/pages/Possibilities/Possibilities.tsx', import.meta.url), 'utf8');
  assert.match(page, /possibilitiesService\.getPossibilities/);
  assert.match(page, /accountStorage\.getItem/);
  assert.match(page, /aiwrevolusi\.possibilities\.chosenDirection/);
  assert.match(page, /useLearningSkills/);
  assert.match(page, /loadSavedPossibilities\(\{/);
  assert.match(page, /flush: flushWorkspace/);
  assert.match(page, /get: possibilitiesService\.getPossibilities/);
  assert.match(page, /return \(\) => controller\.abort\(\)/);
  assert.match(page, /possibilitiesProfilePath\(readTaskWorkspace\(\)\)/);
  assert.ok((page.match(/to=\{profilePath\}/g) ?? []).length >= 1);
  assert.doesNotMatch(page, /to="\/profile"/);
  assert.match(page, /setError\(""\)/);
  assert.match(page, /SHARED/);
  assert.doesNotMatch(page, /<small>%<\/small>/);
  assert.doesNotMatch(page, /sessionStorage/);
});
