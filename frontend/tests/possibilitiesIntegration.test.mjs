import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  possibilitiesViewState,
  shouldApplyPossibilitiesResult,
} from '../src/pages/Possibilities/possibilitiesModel.ts';

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
  assert.match(page, /aiwrevolusi\.possibilities\.shortlist/);
  assert.match(page, /learning-centre\?q=/);
  assert.doesNotMatch(page, /sessionStorage/);
});
