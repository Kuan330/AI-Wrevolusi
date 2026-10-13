import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_RESTARTS, startSpeech, tidyTranscript } from '../src/features/interview/speech.ts';

function install() {
  const made = [];
  globalThis.SpeechRecognition = class { constructor() { made.push(this); } start() { this.started = true; } stop() { this.stopped = true; } abort() { this.aborted = true; } };
  return made;
}
const said = (recognizer, pieces) => recognizer.onresult({ resultIndex: 0, results: pieces.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
const handlers = () => { const log = { text: [], errors: [], ended: 0 }; return { log, h: { onText: (text, done) => log.text.push([text, done]), onError: (message, code) => log.errors.push(code), onEnd: () => { log.ended += 1; } } }; };
test.afterEach(() => { delete globalThis.SpeechRecognition; });

test('a transcript gets a capital letter, a proper "I" and a full stop only when finished', () => {
  assert.equal(tidyTranscript('i checked the totals and i fixed two mistakes'), 'I checked the totals and I fixed two mistakes');
  assert.equal(tidyTranscript('  i\'m sure i\'ll   do it  ', true), "I'm sure I'll do it.");
  assert.equal(tidyTranscript('Did it work?', true), 'Did it work?');
  assert.equal(tidyTranscript('   '), '');
  assert.equal(tidyTranscript('hi', false), 'Hi');
  assert.equal(tidyTranscript('this is a bike in the city'), 'This is a bike in the city');
});

test('English is requested and live text is reported apart from finished text', () => {
  const made = install(), { log, h } = handlers();
  startSpeech(h);
  assert.equal(made[0].lang, 'en-MY'); assert.equal(made[0].continuous, true); assert.equal(made[0].interimResults, true);
  said(made[0], [['i checked', true], ['the totals', false]]);
  assert.deepEqual(log.text.at(-1), ['i checked the totals', 'i checked']);
});

test('unchanged interim words survive an update that starts after index zero', () => {
  const made = install(), { log, h } = handlers();
  startSpeech(h);
  said(made[0], [['i checked', false], ['the total', false]]);
  made[0].onresult({ resultIndex: 1, results: [Object.assign([{ transcript: 'i checked' }], { isFinal: false }), Object.assign([{ transcript: 'the totals' }], { isFinal: false })] });
  assert.deepEqual(log.text.at(-1), ['i checked the totals', '']);
});

test('the current result list replaces interim text and never duplicates final phrases', () => {
  const made = install(), { log, h } = handlers();
  startSpeech(h);
  said(made[0], [['first phrase', true], ['old guess', false]]);
  said(made[0], [['first phrase', true], ['better guess', false]]);
  assert.deepEqual(log.text.at(-1), ['first phrase better guess', 'first phrase']);
  made[0].onresult({ resultIndex: 1, results: [Object.assign([{ transcript: 'first phrase' }], { isFinal: true })] });
  assert.deepEqual(log.text.at(-1), ['first phrase', 'first phrase']);
});

test('stop retains visible interim words when the browser ends without a final result', () => {
  const made = install(), { log, h } = handlers();
  const session = startSpeech(h);
  said(made[0], [['i checked the totals', false]]);
  session.stop(); made[0].onend();
  assert.deepEqual(log.text.at(-1), ['i checked the totals', 'i checked the totals']);
  assert.equal(log.ended, 1);
});

test('a restart preserves pending words and ignores late events from the old recognizer', () => {
  const made = install(), { log, h } = handlers();
  startSpeech(h);
  said(made[0], [['first part', false]]); made[0].onend();
  said(made[1], [['second part', true]]);
  assert.deepEqual(log.text.at(-1), ['first part second part', 'first part second part']);
  const count = log.text.length;
  said(made[0], [['stale result', true]]);
  assert.equal(log.text.length, count);
});

test('listening status follows native start and pauses while the recognizer restarts', () => {
  const made = install(), { log, h } = handlers();
  log.listening = [];
  startSpeech({ ...h, onListening: value => log.listening.push(value) });
  assert.deepEqual(log.listening, []);
  made[0].onstart();
  assert.deepEqual(log.listening, [true]);
  made[0].onend();
  assert.deepEqual(log.listening, [true, false]);
  made[1].onstart();
  assert.deepEqual(log.listening, [true, false, true]);
});

test('a session the browser ends early is restarted, up to a limit, and keeps the words heard', () => {
  const made = install(), { log, h } = handlers();
  startSpeech(h);
  said(made[0], [['first part', true]]);
  for (let i = 0; i < MAX_RESTARTS; i++) { made.at(-1).onend(); assert.equal(log.ended, 0); }
  assert.equal(made.length, MAX_RESTARTS + 1);
  said(made.at(-1), [['second part', true]]);
  assert.deepEqual(log.text.at(-1), ['first part second part', 'first part second part']);
  made.at(-1).onend();
  assert.equal(log.ended, 1); assert.equal(made.length, MAX_RESTARTS + 1);
});

test('stop and cancel end the session without a restart', () => {
  let made = install(), { log, h } = handlers();
  const stopper = startSpeech(h); stopper.stop(); assert.equal(made[0].stopped, true);
  made[0].onend(); assert.equal(log.ended, 1); assert.equal(made.length, 1);
  made = install(); ({ log, h } = handlers());
  const canceller = startSpeech(h); canceller.cancel();
  assert.equal(made[0].aborted, true); assert.equal(log.ended, 1);
  said(made[0], [['late words', true]]); assert.equal(log.text.length, 0);
});

test('an unsupported Malaysian English model falls back to general English once', () => {
  const made = install(), { log, h } = handlers();
  startSpeech(h);
  made[0].onerror({ error: 'language-not-supported' }); made[0].onend();
  assert.equal(made.length, 2); assert.equal(made[1].lang, 'en-US'); assert.deepEqual(log.errors, []);
  made[1].onerror({ error: 'language-not-supported' }); made[1].onend();
  assert.deepEqual(log.errors, ['language-not-supported']); assert.equal(log.ended, 1);
});

test('errors are reported and never restarted, and a quiet end after speaking is not an error', () => {
  let made = install(), { log, h } = handlers();
  startSpeech(h); made[0].onerror({ error: 'network' }); made[0].onend();
  assert.deepEqual(log.errors, ['network']); assert.equal(made.length, 1); assert.equal(log.ended, 1);
  made = install(); ({ log, h } = handlers());
  startSpeech(h); made[0].onerror({ error: 'no-speech' }); made[0].onend();
  assert.deepEqual(log.errors, ['no-speech']);
  made = install(); ({ log, h } = handlers());
  startSpeech(h); said(made[0], [['all done', true]]); made[0].onerror({ error: 'no-speech' }); made[0].onend();
  assert.deepEqual(log.errors, []); assert.equal(log.ended, 1); assert.equal(made.length, 1);
});
