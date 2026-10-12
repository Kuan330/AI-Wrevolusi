import test from 'node:test';
import assert from 'node:assert/strict';

import { api } from '../src/services/api.ts';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function stub(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => { const path = String(url).replace(/^.*\/api\/v1/, ''); calls.push(`${init?.method ?? 'GET'} ${path}`); return handler(path, calls); };
  return calls;
}

test('an expired access cookie is renewed once and the request is repeated', async () => {
  let served = 0;
  const calls = stub(path => {
    if (path === '/auth/refresh') return new Response(null, { status: 204 });
    return ++served === 1 ? json(401, { detail: 'Missing auth cookie.' }) : json(200, { ok: true });
  });
  assert.deepEqual(await api.post('/interview/feedback', { answer: 'x' }), { ok: true });
  assert.deepEqual(calls, ['POST /interview/feedback', 'POST /auth/refresh', 'POST /interview/feedback']);
});

test('when the sign-in itself has expired the original 401 is shown and nothing loops', async () => {
  const calls = stub(path => path === '/auth/refresh' ? json(401, { detail: 'Unauthenticated' }) : json(401, { detail: 'Missing auth cookie.' }));
  await assert.rejects(api.get('/interview/question-bank?occupation_code=2512'), error => error.status === 401 && /sign-in has ended/.test(error.message));
  assert.equal(calls.length, 2);
});

test('several expired requests share one renewal', async () => {
  let refreshes = 0, fresh = false;
  stub(async path => {
    if (path === '/auth/refresh') { refreshes += 1; await new Promise(done => setTimeout(done, 20)); fresh = true; return json(200, {}); }
    return fresh ? json(200, { ok: path }) : json(401, { detail: 'Missing auth cookie.' });
  });
  const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
  assert.equal(refreshes, 1);
  assert.deepEqual(results.map(item => item.ok), ['/a', '/b', '/c']);
});

test('sign-in and account lookups never trigger a renewal', async () => {
  for (const path of ['/auth/login', '/account/login', '/account/register', '/account/me']) {
    const calls = stub(() => json(401, { detail: 'No' }));
    await assert.rejects(api.post(path, {}));
    assert.deepEqual(calls, [`POST ${path}`]);
  }
});
