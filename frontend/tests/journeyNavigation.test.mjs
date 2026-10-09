import assert from 'node:assert/strict';
import test from 'node:test';
import { SIDEBAR_GROUPS, COLLAPSIBLE_MENU_KEYS, filterSidebarGroups, isNavigationItemActive, navigationPath, pageLabel } from '../src/constants/menu.ts';
import { ROUTES, LEGACY_ROUTES } from '../src/constants/routes.ts';

test('personal overview, skills, plans and records have distinct sidebar destinations', () => {
  const paths = SIDEBAR_GROUPS.flatMap(group=>group.items.map(item=>item.path));
  assert.equal(new Set(paths).size,paths.length);
  for (const path of [ROUTES.dashboard,ROUTES.workProfile,ROUTES.aiExposure,ROUTES.skills,ROUTES.learningGoals,ROUTES.progress,ROUTES.possibilities,ROUTES.resumeBuilder]) assert.ok(paths.includes(path));
});
test('task editor and course library highlight the correct parent menu', () => {
  assert.equal(navigationPath(ROUTES.workProfile),ROUTES.workProfile);
  assert.equal(navigationPath(ROUTES.learningCentre),ROUTES.learningGoals);
  assert.equal(navigationPath(ROUTES.aiExposure),ROUTES.aiExposure);
  assert.equal(pageLabel(ROUTES.progress),'Learning records');
});
test('legacy bookmarks redirect without creating duplicate destinations or redirect loops', () => {
  for (const [from,to] of Object.entries(LEGACY_ROUTES)) {
    assert.notEqual(from,to);
    assert.ok(Object.values(ROUTES).includes(to));
    assert.equal(LEGACY_ROUTES[to],undefined);
  }
  assert.equal(LEGACY_ROUTES['/profile/tasks'],ROUTES.workProfile);
  assert.equal(LEGACY_ROUTES['/progress'],ROUTES.progressReviews);
});

test('sidebar has two-level work, learning and Possibilities groups, with only overview as a direct link', () => {
  assert.deepEqual(SIDEBAR_GROUPS.filter(group=>group.collapsible).map(group=>[group.key,group.items.length]),[['work',2],['learning',3],['career',3]]);
  assert.deepEqual(SIDEBAR_GROUPS.filter(group=>!group.collapsible).map(group=>group.items[0].path),[ROUTES.dashboard]);
});


test('resume builder is a child of Possibilities alongside the original exploration page', () => {
  const career = SIDEBAR_GROUPS.find(group => group.key === 'career');
  assert.equal(career.label, 'Possibilities');
  assert.equal(career.collapsible, true);
  assert.deepEqual(career.items.map(item => item.path), [ROUTES.possibilities, ROUTES.resumeBuilder, ROUTES.interview]);
  assert.deepEqual(career.items.map(item => item.label), ['Explore possibilities', 'Resume builder', 'Interview practice']);
  assert.ok(COLLAPSIBLE_MENU_KEYS.includes('career'));
  assert.equal(pageLabel(ROUTES.possibilities), 'Possibilities');
  assert.equal(pageLabel(ROUTES.resumeBuilder), 'Resume builder');
  assert.equal(pageLabel(ROUTES.interview), 'Interview practice');
});

test('only the actual Possibilities child is highlighted; learning nested-page matching is retained', () => {
  const career = SIDEBAR_GROUPS.find(group => group.key === 'career');
  for (const path of [ROUTES.possibilities, ROUTES.resumeBuilder, ROUTES.interview]) assert.deepEqual(career.items.filter(item => isNavigationItemActive(navigationPath(path), item)).map(item => item.path), [path]);
  const plan = SIDEBAR_GROUPS.find(group => group.key === 'learning').items.find(item => item.path === ROUTES.learningGoals);
  assert.equal(isNavigationItemActive(navigationPath(ROUTES.plan), plan), true);
  assert.equal(isNavigationItemActive(navigationPath(ROUTES.learningCentre), plan), true);
});

test('menu search finds the resume child and expands all registered groups without hardcoded keys', () => {
  const matches = filterSidebarGroups('  RESUME  ').filter(group => group.items.length);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].key, 'career');
  assert.deepEqual(matches[0].items.map(item => item.path), [ROUTES.resumeBuilder]);
  assert.deepEqual(COLLAPSIBLE_MENU_KEYS, SIDEBAR_GROUPS.filter(group => group.collapsible).map(group => group.key));
  assert.equal(filterSidebarGroups('Possibilities').find(group => group.key === 'career').items.length, 3);
  assert.deepEqual(filterSidebarGroups(''), SIDEBAR_GROUPS);
});
