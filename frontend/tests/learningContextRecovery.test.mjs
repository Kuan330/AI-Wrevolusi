import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { activateWorkspace } from '../src/services/accountStorage.ts';
import { saveConfirmedAnalysis, saveProfileTasks, confirmProfileTasks } from '../src/features/work-profile/userProfile.ts';
import { startLearning, saveSkillDecision, completeSkillReview } from '../src/features/journey/journey.ts';

// Run the page's actual snapshot callback, including its error boundary, without
// rendering unrelated drawers and browser-only components in the Node runner.
const pageUrl = new URL('../src/pages/LearningCentre/LearningCentre.tsx', import.meta.url);
const source = ts.createSourceFile(pageUrl.pathname, readFileSync(pageUrl, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['journey', 'evidence', 'workSkills'].includes(node.name.getText(source)) && ts.isCallExpression(node.initializer)) {
    callbacks[node.name.getText(source)] = node.initializer.arguments[0].getText(source);
  }
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'selectSkill') callbacks.selectSkill = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(callbacks.journey && callbacks.evidence && callbacks.workSkills && callbacks.selectSkill, 'test the actual protected page read and skill-selection callbacks');
const journeyUrl = new URL('../src/features/journey/journey.ts', import.meta.url).href;
const toModuleUrl = text => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`;
const matcherUrl = toModuleUrl(readFileSync(new URL('../src/features/skills/matchSkills.ts', import.meta.url), 'utf8'));
const skillProfileUrl = toModuleUrl(readFileSync(new URL('../src/features/skills/skillProfile.ts', import.meta.url), 'utf8').replace('./matchSkills.ts', matcherUrl));
const learningSkillsUrl = new URL('../src/pages/Skills/learningSkills.ts', import.meta.url).href;
const script = `
import { readJourneyState, readJourneyProfile, readLearningContext, learningContextNeedsReview, isSkillReviewCurrent } from ${JSON.stringify(journeyUrl)};
import { buildSkillEvidence } from ${JSON.stringify(skillProfileUrl)};
import { toLearningSkill } from ${JSON.stringify(learningSkillsUrl)};
export function readPage(params, genericSearch = false, workspaceRevision = 0) { return (${callbacks.journey})(); }
export function currentWorkSkills(journey, wefSkills) { const evidence = (${callbacks.evidence})(); return (${callbacks.workSkills})(); }
export function reselectCurrentSkill(id, activeId) {
  const selecting = false, journey = { error: "" }, contextValid = true, contextStale = false, contextError = "", wefSkills = [];
  const setSelectionError = () => { throw new Error("Active selection must not restart selection or replace its context"); };
  return (${callbacks.selectSkill})(id);
}
`;
const compiled = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { readPage, currentWorkSkills, reselectCurrentSkill } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const memory = new Map();
let writes;
beforeEach(() => {
  activateWorkspace(null);
  memory.clear(); writes = [];
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { writes.push(key); memory.set(key, value); }, removeItem: key => { writes.push(key); memory.delete(key); } };
  globalThis.sessionStorage = { getItem: () => null };
  globalThis.window = new EventTarget();
});
afterEach(() => activateWorkspace(null));

async function careerChoice() {
  saveConfirmedAnalysis({ occupationCode: '4110', occupationTitle: 'Office clerk', occupationPath: [], potential25: null, meanScore2025: null,
    tasks: [{ id: 'task-1', wording: 'Analyse sales data and prepare reports', practice: { trials: [] } }], taskExposureAssessments: [] });
  const url = await startLearning({ origin: 'career', skill: { id: 1, slug: 'analytical-thinking', name: 'Analytical thinking' }, career: { code: '2421', title: 'Business analyst' }, goal: 'Explore analysis for a career change' });
  return new URL(url, 'https://local').searchParams;
}

test('a valid career learning context restores through the page snapshot', async () => {
  const params = await careerChoice(); writes = [];
  const result = readPage(params, false, 2);
  assert.equal(result.error, '');
  assert.equal(result.context.origin, 'career');
  assert.equal(result.contextStale, false);
  assert.equal(result.revision, 2);
  assert.deepEqual(writes, []);
});

test('career context with corrupt work shows recovery without throwing or erasing data', async () => {
  const params = await careerChoice();
  const savedJourney = memory.get('aiwrevolusi.journey.v1');
  memory.set('aiwrevolusi.userProfile', '{invalid'); writes = [];
  const result = readPage(params);
  assert.match(result.error, /saved work could not be read/i);
  assert.equal(result.context, null);
  assert.equal(result.contextStale, true);
  assert.equal(memory.get('aiwrevolusi.userProfile'), '{invalid');
  assert.equal(memory.get('aiwrevolusi.journey.v1'), savedJourney);
  assert.deepEqual(writes, []);
});


test('accepted work skills remain available with confirmed tasks and no AI assessment', async () => {
  const tasks = [{ id: 'task-1', wording: 'Analyse sales data and prepare reports', practice: { trials: [] } }];
  saveProfileTasks('4110', tasks);
  confirmProfileTasks();
  await saveSkillDecision(1, 'accepted');
  await completeSkillReview();
  const url = await startLearning({ origin: 'work', skill: { id: 1, slug: 'analytical-thinking', name: 'Analytical thinking' }, taskIds: ['task-1'], taskLabels: [tasks[0].wording], goal: 'Review report conclusions' });
  writes = [];
  const snapshot = readPage(new URL(url, 'https://local').searchParams);
  assert.equal(snapshot.error, '');
  assert.equal(snapshot.profile.tasksConfirmed, true);
  assert.equal(snapshot.profile.analysis, null);
  assert.equal(snapshot.reviewed, true);
  assert.deepEqual(currentWorkSkills(snapshot, [{ wef_skill_id: 1, core_skill: 'Analytical thinking' }]), [{ id: 'analytical-thinking', name: 'Analytical thinking', source: 'work' }]);
  assert.equal(snapshot.context.goal, 'Review report conclusions');
  assert.deepEqual(writes, []);
});

test('reselecting the active skill preserves its career context and goal', async () => {
  const params = await careerChoice();
  const before = memory.get('aiwrevolusi.journey.v1');
  assert.equal(readPage(params).context.goal, 'Explore analysis for a career change');
  writes = [];
  await reselectCurrentSkill(params.get('skill'), params.get('skill'));
  assert.equal(memory.get('aiwrevolusi.journey.v1'), before);
  assert.deepEqual(writes, []);
});
