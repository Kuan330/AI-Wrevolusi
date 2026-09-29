import test from 'node:test';
import assert from 'node:assert/strict';
import { specialistSkillService } from '../src/services/specialistSkillService.ts';

test('source role selection is sent separately from the profile occupation', async () => {
  const previous = globalThis.fetch;
  let requested;
  globalThis.fetch = async input => { requested = input; return new Response(JSON.stringify({ skills: [] }), { headers: { 'Content-Type': 'application/json' } }); };
  try {
    const uri = 'http://data.europa.eu/esco/occupation/11111111-2222-3333-4444-555555555555';
    await specialistSkillService.forOccupation(uri);
    const params = new URL(requested, 'https://example.test').searchParams;
    assert.equal(params.get('occupation_uri'), uri);
    assert.equal(params.has('occupation_code'), false);
  } finally { globalThis.fetch = previous; }
});
test('numeric Malaysian profile codes cannot request an ESCO occupation mapping', async () => {
  const previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected network request'); };
  try {
    for (const code of ['2351', '3151', '3115', '']) {
      await assert.rejects(specialistSkillService.forOccupation(code), /Choose an ESCO source occupation/);
    }
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previous; }
});
test('all-skills search sends a bounded page and safely encodes search text', async () => {
  const previous = globalThis.fetch;
  let requested;
  globalThis.fetch = async input => { requested = input; return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); };
  try {
    await specialistSkillService.skills('design & test', 20);
    const url = new URL(requested, 'https://example.test');
    assert.equal(url.pathname, '/api/v1/reference/specialist-skill-search');
    assert.equal(url.searchParams.get('q'), 'design & test');
    assert.equal(url.searchParams.get('limit'), '20');
    assert.equal(url.searchParams.get('offset'), '20');
  } finally { globalThis.fetch = previous; }
});

test('catalogue version can be checked without a skill query or a source role', async () => {
  const previous = globalThis.fetch;
  let requested;
  globalThis.fetch = async input => {
    requested = input;
    return new Response(JSON.stringify({ version: '1.2.0', items: [], total: 13939, search_mode: 'browse' }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await specialistSkillService.skills('', 0);
    const url = new URL(requested, 'https://example.test');
    assert.equal(url.searchParams.get('q'), '');
    assert.equal(url.searchParams.has('occupation_uri'), false);
    assert.equal(result.version, '1.2.0');
  } finally { globalThis.fetch = previous; }
});

test('short tool names and partial match evidence remain intact', async () => {
  const previous = globalThis.fetch;
  let requested;
  const item = { uri: 'source-concept', label: 'R', description: 'Use the R programming language', match_type: 'related', matched_terms: ['R'] };
  globalThis.fetch = async input => {
    requested = input;
    return new Response(JSON.stringify({ version: '1.2.0', items: [item], total: 1, search_mode: 'related' }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await specialistSkillService.skills('R', 0);
    assert.equal(new URL(requested, 'https://example.test').searchParams.get('q'), 'R');
    assert.equal(result.search_mode, 'related');
    assert.deepEqual(result.items[0], item);
  } finally { globalThis.fetch = previous; }
});
