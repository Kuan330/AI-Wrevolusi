import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

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

// Resolve the service's Vite aliases while exercising the real API wrapper.
const referenceSource = readFileSync(new URL('../src/services/referenceService.ts', import.meta.url), 'utf8')
  .replaceAll('@/data/pilotWefSkills', new URL('../src/data/pilotWefSkills.ts', import.meta.url).href)
  .replaceAll('@/services/api', new URL('../src/services/api.ts', import.meta.url).href)
  .replaceAll('@/lib/requestCache', new URL('../src/lib/requestCache.ts', import.meta.url).href);
const referenceJs = ts.transpileModule(referenceSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { referenceService } = await import(`data:text/javascript;base64,${Buffer.from(referenceJs).toString('base64')}`);

test('occupation search keeps a translated result that arrives after 12s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const occupation = { occupation_code: '2411', level: 'unit', title: 'Accountants' };
  await withFetch(
    (_url, init) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(jsonResponse([occupation])), 14_000);
      init.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }),
    async () => {
      const pending = referenceService.searchOccupations('会计师');
      t.mock.timers.tick(14_000);
      assert.deepEqual(await pending, [occupation]);
    },
  );
});

test('occupation search still cancels when its caller aborts', async () => {
  const controller = new AbortController();
  let requestSignal;
  await withFetch(
    (_url, init) => new Promise((_resolve, reject) => {
      requestSignal = init.signal;
      init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
    async () => {
      const pending = referenceService.searchOccupations('会计师', controller.signal);
      controller.abort();
      await assert.rejects(pending, error => error instanceof ApiError && error.status === 408);
      assert.equal(requestSignal.aborted, true);
    },
  );
});
