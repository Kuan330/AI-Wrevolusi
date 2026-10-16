import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, resetApiSession } from '../src/services/api.ts';
import { resumeService } from '../src/features/resume/service.ts';

const json = (body, status = 200) => Response.json(body, { status });
const unauthorized = () => json({ detail: 'Missing auth cookie.' }, 401);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => { resetApiSession(); globalThis.window = new EventTarget(); });

test('parallel interview, resume, progress and PDF requests share one renewal and preserve their payloads', async () => {
  const seen = [], refreshStarted = deferred(), release = deferred();
  let renewed = false, refreshes = 0;
  globalThis.fetch = async (url, init) => {
    seen.push({ url, body: init.body, credentials: init.credentials, headers: init.headers });
    if (url.endsWith('/auth/refresh')) { refreshes++; refreshStarted.resolve(); await release.promise; renewed = true; return json({}); }
    if (!renewed) return unauthorized();
    return url.endsWith('/resume/render') ? new Response('%PDF fixture', { headers: { 'content-type': 'application/pdf' } }) : json({ ok: true });
  };
  const document = { cv: { sections: { Skills: [{ bullet: 'SQL' }] } } };
  const requests = [
    api.get('/interview/question-bank?occupation_code=2434&limit=12'),
    api.post('/interview/plan', { count: 4 }), api.post('/resume/assist', { instruction: 'Polish wording' }),
    api.get('/learning/progress'), resumeService.render(document, new AbortController().signal),
  ];
  await refreshStarted.promise; release.resolve();
  const results = await Promise.all(requests);
  assert.equal(refreshes, 1);
  assert.equal(await results.at(-1).text(), '%PDF fixture');
  for (const path of ['/interview/plan', '/resume/assist', '/resume/render']) {
    const calls = seen.filter(call => call.url.endsWith(path));
    assert.equal(calls.length, 2); assert.equal(calls[0].body, calls[1].body);
    assert.deepEqual(calls[0].headers, calls[1].headers);
  }
  assert.ok(seen.every(call => call.credentials === 'include'));
});

test('a late 401 from the old cookie reuses the completed renewal', async () => {
  const delayed = deferred(); let refreshes = 0, slowCalls = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return json({}); }
    if (url.endsWith('/late') && ++slowCalls === 1) { await delayed.promise; return unauthorized(); }
    return refreshes ? json({ ok: true }) : unauthorized();
  };
  const late = api.get('/late');
  await api.get('/resume/capabilities'); delayed.resolve(); await late;
  assert.equal(refreshes, 1); assert.equal(slowCalls, 2);
});

test('expired refresh notifies once and blocks repeated protected calls until login', async () => {
  let events = 0; const paths = [];
  window.addEventListener('api-session-expired', () => events++);
  globalThis.fetch = async url => { paths.push(url); return unauthorized(); };
  await assert.rejects(api.get('/learning/progress'), error => error.status === 401 && error.code === 'session_expired');
  await assert.rejects(api.post('/interview/plan', {}), /Log in again/);
  assert.deepEqual(paths, ['/api/v1/learning/progress', '/api/v1/auth/refresh']); assert.equal(events, 1);
  globalThis.fetch = async url => json(url.endsWith('/account/login') ? { id: 'same-account' } : { ok: true });
  await api.post('/account/login', { username: 'same-account', password: 'synthetic' });
  assert.deepEqual(await api.get('/learning/progress'), { ok: true });
});

test('a rejected replay is not retried or renewed again', async () => {
  const paths = [];
  globalThis.fetch = async url => { paths.push(url); return url.endsWith('/auth/refresh') ? json({}) : unauthorized(); };
  await assert.rejects(api.get('/account/workspace'), error => error.code === 'session_expired');
  assert.deepEqual(paths, ['/api/v1/account/workspace', '/api/v1/auth/refresh', '/api/v1/account/workspace']);
});

test('invalid login and explicit refresh never recursively renew', async () => {
  const paths = [];
  globalThis.fetch = async url => { paths.push(url); return unauthorized(); };
  for (const path of ['/account/login', '/account/register', '/auth/login', '/auth/refresh', '/auth/logout']) {
    await assert.rejects(api.post(path, {}), error => error.status === 401);
  }
  assert.equal(paths.length, 5);
});

test('successful AI calls, validation failures, provider timeouts and server failures are never replayed', async () => {
  for (const status of [200, 422, 504, 500]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return json({ detail: 'Synthetic result' }, status); };
    if (status === 200) await api.post('/resume/assist', {});
    else await assert.rejects(api.post('/resume/assist', {}), error => error.status === status);
    assert.equal(calls, 1);
  }
});

test('cancelling one waiter stops its replay while another waiter completes shared renewal', async () => {
  const entered = deferred(), release = deferred(); let refreshed = false, refreshes = 0;
  const seen = [];
  globalThis.fetch = async url => {
    seen.push(url);
    if (url.endsWith('/auth/refresh')) { refreshes++; entered.resolve(); await release.promise; refreshed = true; return json({}); }
    return refreshed ? json({ ok: true }) : unauthorized();
  };
  const controller = new AbortController();
  const cancelled = api.get('/resume/capabilities', controller.signal);
  const rejected = assert.rejects(cancelled, error => error.status === 408);
  const kept = api.get('/learning/progress');
  await entered.promise; controller.abort(); await rejected;
  release.resolve(); await kept;
  assert.equal(refreshes, 1); assert.equal(seen.filter(url => url.endsWith('/resume/capabilities')).length, 1);
});

test('the original request deadline includes waiting for renewal', async () => {
  const entered = deferred(), release = deferred(); const seen = [];
  globalThis.fetch = async url => { seen.push(url); if (url.endsWith('/auth/refresh')) { entered.resolve(); await release.promise; return json({}); } return unauthorized(); };
  const pending = api.get('/resume/capabilities', undefined, 30);
  const rejected = assert.rejects(pending, error => error instanceof ApiError && error.status === 408);
  await entered.promise; await rejected; release.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(seen.filter(url => url.endsWith('/resume/capabilities')).length, 1);
});

test('an account change during renewal discards stale results without expiring the new account', async () => {
  const entered = deferred(), release = deferred(); let expired = 0; const seen = [];
  window.addEventListener('api-session-expired', () => expired++);
  globalThis.fetch = async url => { seen.push(url); if (url.endsWith('/auth/refresh')) { entered.resolve(); await release.promise; } return unauthorized(); };
  const pending = api.get('/learning/progress');
  const rejected = assert.rejects(pending, error => error.code === 'session_changed');
  await entered.promise; resetApiSession(); release.resolve(); await rejected;
  assert.equal(expired, 0); assert.equal(seen.length, 2);
  globalThis.fetch = async () => json({ owner: 'new-account' });
  assert.deepEqual(await api.get('/account/me'), { owner: 'new-account' });
});

test('a temporary renewal server failure is reported without logging out or replaying', async () => {
  let expired = 0; const paths = [];
  window.addEventListener('api-session-expired', () => expired++);
  globalThis.fetch = async url => { paths.push(url); return url.endsWith('/auth/refresh') ? json({ detail: 'Temporarily unavailable' }, 503) : unauthorized(); };
  await assert.rejects(api.get('/learning/progress'), error => error.status === 503);
  assert.equal(paths.length, 2); assert.equal(expired, 0);
});

test('login waits for an existing cookie rotation so old refresh cookies cannot overwrite login', async () => {
  const entered = deferred(), release = deferred(); let refreshed = false; const paths = [];
  globalThis.fetch = async url => {
    paths.push(url);
    if (url.endsWith('/auth/refresh')) { entered.resolve(); await release.promise; refreshed = true; return json({}); }
    if (url.endsWith('/account/login')) return json({ id: 'signed-in-account' });
    return refreshed ? json({ ok: true }) : unauthorized();
  };
  const request = api.get('/learning/progress');
  // A concurrent login may invalidate the original request after its replay starts.
  const original = request.catch(error => { assert.equal(error.code, 'session_changed'); });
  await entered.promise;
  const login = api.post('/account/login', { username: 'synthetic', password: 'synthetic' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(paths.includes('/api/v1/account/login'), false);
  release.resolve(); await Promise.all([original, login]);
  assert.equal(paths.filter(path => path.endsWith('/auth/refresh')).length, 1);
});
