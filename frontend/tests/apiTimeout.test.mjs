import test from 'node:test';
import assert from 'node:assert/strict';

import { api, ApiError } from '../src/services/api.ts';

/**
 * The shared wrapper aborted every request after 4s. On the deployed
 * serverless host a real response can take 7-8s under concurrent testers, so
 * the page reported "try again" for requests the server had already answered.
 * These tests exercise the real request path with a stubbed fetch.
 */

const jsonResponse = (body) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const withFetch = async (impl, run) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
};

test('default budget tolerates a response that takes longer than the old 4s limit', async () => {
  // 4200ms is past the previous default and inside the current one.
  await withFetch(
    (_url, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(jsonResponse({ ok: true })), 4200);
        init.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    async () => {
      const result = await api.get('/slow-but-real');
      assert.deepEqual(result, { ok: true });
    },
  );
});

test('a caller-supplied budget is still enforced', async () => {
  await withFetch(
    (_url, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(jsonResponse({ late: true })), 5000);
        init.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    async () => {
      await assert.rejects(
        () => api.get('/too-slow', undefined, 60),
        (error) => error instanceof ApiError && error.status === 408,
      );
    },
  );
});

test('a slow endpoint that answers inside its own budget still succeeds', async () => {
  await withFetch(
    (_url, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(jsonResponse({ saved: true })), 200);
        init.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    async () => {
      const result = await api.get('/slow-endpoint', undefined, 3000);
      assert.deepEqual(result, { saved: true });
    },
  );
});

test('requests still carry credentials and stay on the configured base path', async () => {
  let seen = null;
  await withFetch(
    (url, init) => {
      seen = { url, credentials: init.credentials };
      return Promise.resolve(jsonResponse([]));
    },
    async () => {
      await api.get('/reference/occupations');
    },
  );

  assert.equal(seen.url, '/api/v1/reference/occupations');
  assert.equal(seen.credentials, 'include');
});
