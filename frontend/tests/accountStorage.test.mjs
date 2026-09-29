import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountStorage, activateWorkspace, flushWorkspace, commitWorkspaceItems } from '../src/services/accountStorage.ts';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
globalThis.window = new EventTarget();
const key = 'aiwrevolusi.possibilities.chosenDirection';

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

test('account conflict banner offers backup and reload instead of futile retry', () => {
  const provider = readFileSync(
    new URL('../src/components/account/AccountProvider.tsx', import.meta.url),
    'utf8',
  );
  const storage = readFileSync(
    new URL('../src/services/accountStorage.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(provider, /Retry saving/);
  assert.doesNotMatch(storage, /Retry saving/);
  assert.match(provider, /Download local backup and reload saved account/);
  assert.match(storage, /Download a local backup and reload the saved account/);
});


test('confirmed records publish only after server acknowledgement', async () => {
  const profileKey = 'aiwrevolusi.userProfile';
  activateWorkspace('confirmed-ack', {data: {[profileKey]: 'old'}, revision: 0});
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  const pending = commitWorkspaceItems({[profileKey]: 'new'});
  await new Promise(done => setImmediate(done));
  assert.equal(accountStorage.getItem(profileKey), 'old');
  resolve(new Response(JSON.stringify({data:{[profileKey]:'new'},revision:1}), {headers:{'content-type':'application/json'}}));
  await pending;
  assert.equal(accountStorage.getItem(profileKey), 'new');
  activateWorkspace(null);
});

test('failed confirmed save leaves prior records and draft intact', async () => {
  const profileKey='aiwrevolusi.userProfile', draftKey='aiwrevolusi.workProfileDraft.v1';
  activateWorkspace('confirmed-fail', {data:{[profileKey]:'old',[draftKey]:'draft'},revision:0});
  globalThis.fetch=async()=>new Response(JSON.stringify({detail:'offline'}),{status:503,headers:{'content-type':'application/json'}});
  await assert.rejects(commitWorkspaceItems({[profileKey]:'new',[draftKey]:null}));
  assert.equal(accountStorage.getItem(profileKey),'old');
  assert.equal(accountStorage.getItem(draftKey),'draft');
  activateWorkspace(null);
});

test('confirmed save cannot publish after the owner changes',async()=>{
  activateWorkspace('confirmed-owner', {data:{},revision:0});
  let resolve;
  globalThis.fetch=()=>new Promise(done=>{resolve=done;});
  const pending=commitWorkspaceItems({'aiwrevolusi.userProfile':'one'});
  await new Promise(done=>setImmediate(done));
  activateWorkspace('other-owner',{data:{},revision:0});
  resolve(new Response(JSON.stringify({data:{},revision:1}),{headers:{'content-type':'application/json'}}));
  await assert.rejects(pending,/account changed/);
  assert.equal(accountStorage.getItem('aiwrevolusi.userProfile'),null);
  activateWorkspace(null);
});

test('concurrent confirmation cannot overwrite a newer confirmed value', async () => {
  const profileKey='aiwrevolusi.userProfile';
  activateWorkspace('serial-confirm', {data:{[profileKey]:'old'},revision:0});
  let resolve; let calls=0;
  globalThis.fetch=()=>{calls++;return new Promise(done=>{resolve=done;});};
  const first=commitWorkspaceItems({[profileKey]:'first'});
  const second=commitWorkspaceItems({[profileKey]:'second'});
  await new Promise(done=>setImmediate(done));
  assert.equal(calls,1);
  assert.throws(()=>accountStorage.setItem(profileKey,'concurrent edit'),/being saved/);
  resolve(new Response(JSON.stringify({data:{},revision:1}),{headers:{'content-type':'application/json'}}));
  await first;
  await assert.rejects(second,/work changed/);
  assert.equal(accountStorage.getItem(profileKey),'first');
  activateWorkspace(null);
});

test('browser cache failure does not turn acknowledged account save into failure',async()=>{
  const profileKey='aiwrevolusi.userProfile';
  activateWorkspace('cache-confirm',{data:{[profileKey]:'old'},revision:0});
  globalThis.fetch=async()=>new Response(JSON.stringify({data:{},revision:1}),{headers:{'content-type':'application/json'}});
  const set=localStorage.setItem;
  localStorage.setItem=()=>{throw Error('quota');};
  try { await commitWorkspaceItems({[profileKey]:'new'}); assert.equal(accountStorage.getItem(profileKey),'new'); }
  finally {localStorage.setItem=set;activateWorkspace(null);}
});
