import assert from 'node:assert/strict';
import test from 'node:test';
import { SIDEBAR_GROUPS, navigationPath, pageLabel } from '../src/constants/menu.ts';
import { ROUTES, LEGACY_ROUTES } from '../src/constants/routes.ts';

test('work overview, skills, plans and records have distinct sidebar destinations', () => {
  const paths = SIDEBAR_GROUPS.flatMap(group=>group.items.map(item=>item.path));
  assert.equal(new Set(paths).size,paths.length);
  for (const path of [ROUTES.dashboard,ROUTES.workProfile,ROUTES.aiExposure,ROUTES.skills,ROUTES.learningGoals,ROUTES.progress,ROUTES.possibilities]) assert.ok(paths.includes(path));
});
test('task editor and course library highlight the correct parent menu', () => {
  assert.equal(navigationPath(ROUTES.task),ROUTES.workProfile);
  assert.equal(navigationPath(ROUTES.learningCentre),ROUTES.learningGoals);
  assert.equal(navigationPath(ROUTES.aiExposure),ROUTES.aiExposure);
  assert.equal(pageLabel(ROUTES.progress),'Learning history & progress');
});
test('legacy bookmarks redirect without creating duplicate destinations or redirect loops', () => {
  for (const [from,to] of Object.entries(LEGACY_ROUTES)) {
    assert.notEqual(from,to);
    assert.ok(Object.values(ROUTES).includes(to));
    assert.equal(LEGACY_ROUTES[to],undefined);
  }
  assert.equal(LEGACY_ROUTES['/profile/tasks'],ROUTES.task);
  assert.equal(LEGACY_ROUTES['/progress'],ROUTES.progressReviews);
});

test('sidebar has two-level work and learning groups, while overview and careers are direct links', () => {
  assert.deepEqual(SIDEBAR_GROUPS.filter(group=>group.collapsible).map(group=>[group.key,group.items.length]),[['work',2],['learning',3]]);
  assert.deepEqual(SIDEBAR_GROUPS.filter(group=>!group.collapsible).map(group=>group.items[0].path),[ROUTES.dashboard,ROUTES.possibilities]);
});
