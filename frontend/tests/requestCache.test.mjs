import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestCache } from '../src/lib/requestCache.ts';

const memoryStorage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }; };

test('a fresh value is reused and concurrent callers share one request', async () => {
  let calls = 0;
  const cache = createRequestCache({ maxAgeMs: 1000 });
  const request = () => { calls++; return Promise.resolve(['a']); };
  const [first, second] = await Promise.all([cache.load('k', request), cache.load('k', request)]);
  assert.deepEqual(first, ['a']); assert.equal(second, first);
  await cache.load('k', request);
  assert.equal(calls, 1);
});

test('a stale value is still visible but the next load refreshes it', async () => {
  let time = 0;
  const cache = createRequestCache({ maxAgeMs: 100, now: () => time });
  await cache.load('k', async () => 'old');
  time = 101;
  assert.deepEqual(cache.peek('k'), { value: 'old', fresh: false });
  assert.equal(await cache.load('k', async () => 'new'), 'new');
  assert.deepEqual(cache.peek('k'), { value: 'new', fresh: true });
});

test('failures are not cached, so the next call retries', async () => {
  const cache = createRequestCache({ maxAgeMs: 1000 });
  await assert.rejects(cache.load('k', async () => { throw new Error('offline'); }));
  assert.equal(cache.peek('k'), undefined);
  assert.equal(await cache.load('k', async () => 'ok'), 'ok');
});

test('a stored value survives a reload and unreadable storage is ignored', async () => {
  const storage = memoryStorage();
  await createRequestCache({ maxAgeMs: 1000, storageKey: 's', storage: () => storage }).load('k', async () => [1, 2]);
  assert.deepEqual(createRequestCache({ maxAgeMs: 1000, storageKey: 's', storage: () => storage }).peek('k')?.value, [1, 2]);
  storage.setItem('s', '{not json');
  assert.equal(createRequestCache({ maxAgeMs: 1000, storageKey: 's', storage: () => storage }).peek('k'), undefined);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
  const cache = createRequestCache({ maxAgeMs: 1000, storageKey: 's', storage: () => blocked });
  assert.equal(await cache.load('k', async () => 'kept in memory'), 'kept in memory');
  assert.equal(cache.peek('k')?.value, 'kept in memory');
});
