import test from 'node:test';
import assert from 'node:assert/strict';
import { activateWorkspace } from '../src/services/accountStorage.ts';
import { possibilitiesService } from '../src/services/possibilitiesService.ts';
import { postLearningProgress } from '../src/services/learningService.ts';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,value), removeItem: key => memory.delete(key) };
globalThis.window = new EventTarget();
test('career cache reuses results only for the same owner and unchanged input', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ contract_version: '2', status: 'ready', directions: [] }); };
  activateWorkspace('one', { data: {}, revision: 0 });
  await possibilitiesService.getPossibilities(); await possibilitiesService.getPossibilities();
  assert.equal(calls, 1);
  activateWorkspace('one', { data: { 'aiwrevolusi.userProfile': '{"tasksOccupationCode":"2"}' }, revision: 1 });
  await possibilitiesService.getPossibilities(); assert.equal(calls, 2);
  activateWorkspace('two', { data: {}, revision: 0 });
  await possibilitiesService.getPossibilities(); assert.equal(calls, 3);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(possibilitiesService.getPossibilities(controller.signal));
  assert.equal(calls, 3);
});
test('a late career response cannot populate another account cache', async () => {
  memory.clear();
  activateWorkspace('old', { data: {}, revision: 0 });
  let resolveResponse;
  globalThis.fetch = () => new Promise(resolve => { resolveResponse = resolve; });
  const pending = possibilitiesService.getPossibilities();
  activateWorkspace('new', { data: {}, revision: 0 });
  resolveResponse(Response.json({ contract_version: '2', status: 'ready', directions: [] }));
  await pending;
  assert.equal(memory.has('aiwrevolusi.possibilities.cache.v1.old'), false);
  assert.equal(memory.has('aiwrevolusi.possibilities.cache.v1.new'), false);
  activateWorkspace(null);
});
test('a successful learning progress save refreshes cached career results', async () => {
  memory.clear();
  activateWorkspace('progress', { data: {}, revision: 0 });
  let reads = 0;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/learning/progress')) return Response.json({ accepted: [] });
    reads++;
    return Response.json({ contract_version: '2', status: 'ready', directions: [] });
  };
  await possibilitiesService.getPossibilities();
  await possibilitiesService.getPossibilities();
  assert.equal(reads, 1);
  await postLearningProgress('2026-10-13', []);
  await possibilitiesService.getPossibilities();
  assert.equal(reads, 2);
  activateWorkspace(null);
});
test('an older pending career response cannot undo progress invalidation', async () => {
  memory.clear();
  activateWorkspace('pending-progress', { data: {}, revision: 0 });
  let resolveResponse;
  globalThis.fetch = url => String(url).endsWith('/learning/progress')
    ? Promise.resolve(Response.json({ accepted: [] }))
    : new Promise(resolve => { resolveResponse = resolve; });
  const pending = possibilitiesService.getPossibilities();
  await postLearningProgress('2026-10-13', []);
  resolveResponse(Response.json({ contract_version: '2', status: 'ready', directions: [] }));
  await pending;
  assert.equal(memory.has('aiwrevolusi.possibilities.cache.v1.pending-progress'), false);
  activateWorkspace(null);
});
