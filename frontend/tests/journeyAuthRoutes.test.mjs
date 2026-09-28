import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Outlet, useLocation } from 'react-router-dom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const packageUrl = name => pathToFileURL(require.resolve(name)).href;
let signedIn = false;
let guardVisits = 0;
let requestedPath = '/skills';

// Exercise the real route tree. Only page content and account state are doubled;
// a prerequisite check before login must fail, rather than read a guest profile.
globalThis.journeyRouteFixtures = {
  useAccount: () => ({ user: signedIn ? { id: 'saved-account' } : null }),
  AccountProvider: ({ children }) => children,
  AccountGate: ({ children }) => {
    const location = useLocation();
    return signedIn ? children : React.createElement('div', {
      'data-login-destination': location.pathname + location.search + location.hash,
    }, 'Sign in to restore your work');
  },
  MainLayout: Outlet,
  ProfileLayout: Outlet,
  RequireWorkTasks: () => {
    assert.equal(signedIn, true, 'Work prerequisites ran before account access');
    guardVisits += 1;
    return React.createElement(Outlet);
  },
  RequireConfirmedAnalysis: () => {
    assert.equal(signedIn, true, 'Analysis prerequisites ran before account access');
    guardVisits += 1;
    return React.createElement(Outlet);
  },
};
Object.defineProperty(globalThis.journeyRouteFixtures, 'requestedPath', { get: () => requestedPath });
for (const name of ['ContinueJourney', 'SkillsReview', 'AIExposure', 'Home', 'LearningCentre', 'Possibilities', 'Plan', 'WorkProfile', 'ProfileTasks']) {
  globalThis.journeyRouteFixtures[name] = () => React.createElement('div', { 'data-page': name });
}
const routerModule = moduleUrl(`
  export * from ${JSON.stringify(packageUrl('react-router-dom'))};
  import { MemoryRouter } from ${JSON.stringify(packageUrl('react-router-dom'))};
  import { createElement } from ${JSON.stringify(packageUrl('react'))};
  export function BrowserRouter({ children }) {
    return createElement(MemoryRouter, { initialEntries: [globalThis.journeyRouteFixtures.requestedPath] }, children);
  }
`);
const routesModule = moduleUrl(ts.transpileModule(
  readFileSync(new URL('../src/constants/routes.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText);
const transpiled = ts.transpileModule(readFileSync(new URL('../src/routes/index.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(packageUrl('react/jsx-runtime'))}`)
  .replaceAll('from "react-router-dom"', `from ${JSON.stringify(routerModule)}`)
  .replace(/from "(@\/[^"]+)"/g, (_match, path) => {
    if (path === '@/constants/routes') return `from ${JSON.stringify(routesModule)}`;
    const name = path.split('/').at(-1);
    return `from ${JSON.stringify(moduleUrl(`const component = globalThis.journeyRouteFixtures[${JSON.stringify(name)}]; export default component; export { component as ${name} };`))}`;
  });
const { default: AppRoutes } = await import(moduleUrl(transpiled));

for (const [path, page] of [['/skills?step=review#current', 'SkillsReview'], ['/ai-exposure?view=tasks', 'AIExposure']]) {
  test(`account access precedes saved-work checks and preserves ${path}`, () => {
    signedIn = false; guardVisits = 0; requestedPath = path;
    const entry = renderToString(React.createElement(AppRoutes));
    assert.ok(entry.includes(`data-login-destination="${path}"`));
    assert.equal(guardVisits, 0);
    signedIn = true;
    assert.ok(renderToString(React.createElement(AppRoutes)).includes(`data-page="${page}"`));
    assert.equal(guardVisits, 1);
  });
}
