import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canStartTaskAssist,
  DEFAULT_TASK_ASSIST_QUESTION,
  hasSavedTaskAssist,
  taskAssistContextKey,
  taskAssistResponseLabel,
  shouldApplyTaskAssistResult,
} from '../src/pages/AIExposure/lib/taskAssistState.ts';

test('uses the approved default question verbatim', () => {
  assert.equal(
    DEFAULT_TASK_ASSIST_QUESTION,
    'How can AI assist me in completing this task?',
  );
});

test('only an unused registered detail can open the assistant', () => {
  assert.equal(canStartTaskAssist('available'), true);
  assert.equal(canStartTaskAssist('pending'), false);
  assert.equal(canStartTaskAssist('completed'), false);
  assert.equal(hasSavedTaskAssist('completed'), true);
  assert.equal(hasSavedTaskAssist('available'), false);
});

test('labels model and fallback responses without exposing provider details', () => {
  assert.equal(taskAssistResponseLabel(true), 'Model response');
  assert.equal(
    taskAssistResponseLabel(false),
    'Fallback guidance — the AI model was unavailable.',
  );
});

test('ignores a completion after the dialog closes or changes task', () => {
  assert.equal(shouldApplyTaskAssistResult(2, 2, true, 'task-b', 'task-b'), true);
  assert.equal(shouldApplyTaskAssistResult(1, 2, true, 'task-b', 'task-b'), false);
  assert.equal(shouldApplyTaskAssistResult(2, 2, false, 'task-b', 'task-b'), false);
  assert.equal(shouldApplyTaskAssistResult(2, 2, true, 'task-a', 'task-b'), false);
});

test('task context key changes for same-id wording or note edits', () => {
  const original = taskAssistContextKey('task-a', 'Draft the report', 'Weekly');
  assert.notEqual(
    original,
    taskAssistContextKey('task-a', 'Review the report', 'Weekly'),
  );
  assert.notEqual(
    original,
    taskAssistContextKey('task-a', 'Draft the report', 'Monthly'),
  );
});

test('drawer companion generates guidance without a Chat with AI dialog', () => {
  const drawer = readFileSync(
    new URL(
      '../src/pages/Analysis/components/TaskDetailsDrawer.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const guidePet = readFileSync(
    new URL(
      '../src/pages/Analysis/components/TaskAssistGuidePet.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const service = readFileSync(
    new URL('../src/services/aiService.ts', import.meta.url),
    'utf8',
  );

  assert.match(drawer, /registerTaskAssistDetails/);
  assert.match(drawer, /TaskAssistGuidePet/);
  assert.match(drawer, /aiService\.taskAssist/);
  assert.match(drawer, /DEFAULT_TASK_ASSIST_QUESTION/);
  assert.doesNotMatch(drawer, /TaskAssistDialog|Chat with AI|setChatOpen|MessageSquare/);
  assert.match(guidePet, /Saved AI guidance/);
  assert.match(guidePet, /Thinking…/);
  assert.match(guidePet, /onRequestGuidance/);
  assert.match(guidePet, /setOpen/);
  assert.doesNotMatch(guidePet, /onMouseEnter|setHovered|setPinned/);
  assert.doesNotMatch(guidePet, /pickContextLine|composeGreeting|useBotPetGreeting/);
  assert.match(drawer, /task_key: task\.id/);
  assert.match(drawer, /getTaskAssist/);
  assert.match(drawer, /setTimeout/);
  assert.match(drawer, /saved\.status === "available" && attempts < 6/);
  assert.match(service, /registerTaskAssistDetails/);
  assert.match(service, /task_key: string/);
  assert.match(service, /getTaskAssist/);
  assert.match(service, /"\/ai\/task-assist\/details"/);
  assert.match(drawer, /useAccount/);
  assert.match(drawer, /if \(!user\) return null/);
  assert.match(drawer, /task-details__assist-container/);
  const contentStart = drawer.indexOf('<DrawerContent');
  const savedAccess = drawer.lastIndexOf('<TaskAssistAccess');
  const contentEnd = drawer.indexOf('</DrawerContent>');
  assert.ok(
    contentStart >= 0 && contentStart < savedAccess && savedAccess < contentEnd,
  );
});

test('dialog module keeps single-turn guards for optional reuse', () => {
  const dialog = readFileSync(
    new URL(
      '../src/pages/Analysis/components/TaskAssistDialog.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const service = readFileSync(
    new URL('../src/services/aiService.ts', import.meta.url),
    'utf8',
  );

  assert.match(dialog, /onStarted/);
  assert.match(dialog, /task_key: interaction\.task_key/);
  assert.match(dialog, /onCompleted\(saved\);\s*onOpenChange\(false\)/);
  assert.ok(
    dialog.indexOf('onStarted(') < dialog.indexOf('aiService.taskAssist'),
    'parent pending state must be published before the request starts',
  );
  assert.doesNotMatch(dialog, /task_text: task\.wording/);
  assert.doesNotMatch(dialog, /Close and reopen to ask again/);
  assert.match(dialog, /!completed \? \([\s\S]{0,120}<form/);
  assert.match(dialog, /sending \|\| completed/);
  assert.match(dialog, /new AbortController\(\)/);
  assert.match(dialog, /maxLength=\{2000\}/);
  assert.match(dialog, /role="status"/);
  assert.match(dialog, /role="alert"/);
  assert.equal((dialog.match(/aria-live="polite"/g) ?? []).length, 1);
  assert.match(dialog, /aria-live="polite"[\s\S]{0,80}aria-atomic="false"/);
  assert.match(
    dialog,
    /key=\{`\$\{open \? "open" : "closed"\}:\$\{contextKey\}`\}/,
  );
  assert.match(dialog, /mountedRef/);
  assert.doesNotMatch(dialog, /useLayoutEffect/);
  assert.match(service, /TASK_ASSIST_TIMEOUT_MS = 45000/);
  assert.match(service, /taskAssist: \(request: TaskAssistRequest, signal\?: AbortSignal\)/);
});
