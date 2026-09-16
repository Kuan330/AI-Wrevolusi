import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStorage, activateWorkspace, flushWorkspace } from '../src/services/accountStorage.ts';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
globalThis.window = new EventTarget();
const key = 'aiwrevolusi.possibilities.intent';

test('account workspaces isolate guest data and save only under the expected owner', async () => {
  activateWorkspace(null);
  accountStorage.setItem(key, '"guest"');
  activateWorkspace('one', { data: {}, revision: 0 });
  assert.equal(accountStorage.getItem(key), null);
  let body;
  globalThis.fetch = async (_url, init) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ data: body.data, revision: 1 }), { headers: { 'content-type': 'application/json' } }); };
  accountStorage.setItem(key, '"grow"');
  await flushWorkspace();
  assert.equal(body.owner_id, 'one');
  assert.equal(body.data[key], '"grow"');
  activateWorkspace('two', { data: {}, revision: 0 });
  assert.equal(accountStorage.getItem(key), null);
  activateWorkspace(null);
  assert.equal(accountStorage.getItem(key), '"guest"');
});

test('a rejected sync retains local changes rather than silently replacing server data', async () => {
  activateWorkspace('conflict', { data: {}, revision: 0 });
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Another session changed this account.' }), { status: 409, headers: { 'content-type': 'application/json' } });
  accountStorage.setItem(key, '"new"');
  await assert.rejects(flushWorkspace(), /Another session/);
  assert.equal(accountStorage.getItem(key), '"new"');
  assert.equal(JSON.parse(memory.get('aiwrevolusi.account.conflict')).dirty, true);
  activateWorkspace(null);
});
