import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_AUDIO_BYTES, startAudioRecording } from '../src/features/interview/audioRecording.ts';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
function setup({ capture, transcribe } = {}) {
  const made = [], log = { audio: [], text: [], errors: [], ended: 0, stoppedTracks: 0, processing: 0 };
  const stream = { getTracks: () => [{ stop: () => { log.stoppedTracks++; } }] };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: capture ?? (async () => stream) } } });
  globalThis.MediaRecorder = class {
    static isTypeSupported = type => type.startsWith('audio/webm');
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; made.push(this); }
    start() { this.state = 'recording'; this.onstart?.(); }
    stop() { this.state = 'inactive'; this.completion = this.onstop?.(); }
  };
  const h = {
    onText: (text, done) => log.text.push([text, done]), onError: message => log.errors.push(message), onEnd: () => { log.ended++; },
    onProcessing: () => { log.processing++; }, transcribe: transcribe ?? (async audio => { log.audio.push(audio); return 'I checked the totals.'; }),
  };
  return { made, log, h, stream };
}
test.afterEach(() => { Object.defineProperty(globalThis, 'navigator', originalNavigator); delete globalThis.MediaRecorder; });

test('Stop sends captured audio once, releases the microphone and returns editable text', async () => {
  const { made, log, h } = setup();
  const session = await startAudioRecording(h, new AbortController().signal);
  made[0].ondataavailable({ data: new Blob(['recorded audio']) });
  session.stop(); await made[0].completion;
  assert.equal(log.audio.length, 1); assert.equal(log.audio[0].type, 'audio/webm;codecs=opus');
  assert.equal(await log.audio[0].text(), 'recorded audio');
  assert.deepEqual(log.text, [['I checked the totals.', 'I checked the totals.']]);
  assert.ok(log.stoppedTracks > 0); assert.equal(log.ended, 1);
});

test('Cancel discards audio without sending it', async () => {
  const { made, log, h } = setup();
  const session = await startAudioRecording(h, new AbortController().signal);
  made[0].ondataavailable({ data: new Blob(['discard this']) });
  session.cancel(); await made[0].completion;
  assert.deepEqual(log.audio, []); assert.deepEqual(log.text, []); assert.equal(log.ended, 1);
});

test('cancel during transcription ignores a late result and passes the cancellation signal', async () => {
  let resolve, sentSignal;
  const pending = new Promise(done => { resolve = done; });
  const { made, log, h } = setup({ transcribe: (_audio, signal) => { sentSignal = signal; return pending; } });
  const controller = new AbortController(), session = await startAudioRecording(h, controller.signal);
  made[0].ondataavailable({ data: new Blob(['recording']) }); session.stop();
  controller.abort(); resolve('Late words.'); await made[0].completion;
  assert.equal(sentSignal.aborted, true); assert.deepEqual(log.text, []); assert.equal(log.ended, 1);
});

test('permission arriving after cancellation closes the stream without recording', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const { made, log, h, stream } = setup({ capture: () => pending });
  const controller = new AbortController(), started = startAudioRecording(h, controller.signal);
  controller.abort(); resolve(stream);
  assert.equal(await started, null); assert.equal(made.length, 0); assert.equal(log.stoppedTracks, 1); assert.equal(log.ended, 1);
});

test('late callbacks from a cancelled recording do not change a newer listening session', async () => {
  let resolve; const pending = new Promise(done => { resolve = done; });
  const first = setup({ capture: () => pending }), listening = [];
  const controller = new AbortController(), started = startAudioRecording({ ...first.h, onListening: value => listening.push(value) }, controller.signal);
  controller.abort();
  const second = setup(); const active = await startAudioRecording({ ...second.h, onListening: value => listening.push(value) }, new AbortController().signal);
  resolve(first.stream); await started;
  assert.equal(listening.at(-1), true);
  active.cancel(); const count = listening.length;
  await second.made[0].onstop(); second.made[0].onerror();
  assert.equal(listening.length, count); assert.deepEqual(second.log.errors, []);
});

test('oversized or empty recordings never call the speech provider', async () => {
  for (const size of [0, MAX_AUDIO_BYTES + 1]) {
    const { made, log, h } = setup(); const session = await startAudioRecording(h, new AbortController().signal);
    if (size) made[0].ondataavailable({ data: new Blob([new Uint8Array(size)]) });
    else session.stop();
    await made[0].completion;
    assert.equal(log.audio.length, 0); assert.equal(log.errors.length, 1); assert.equal(log.ended, 1);
  }
});

test('provider failures keep the answer unchanged and release the microphone', async () => {
  const { made, log, h } = setup({ transcribe: async () => { throw new Error('Speech service is unavailable.'); } });
  const session = await startAudioRecording(h, new AbortController().signal);
  made[0].ondataavailable({ data: new Blob(['audio']) }); session.stop(); await made[0].completion;
  assert.deepEqual(log.text, []); assert.deepEqual(log.errors, ['Speech service is unavailable.']);
  assert.ok(log.stoppedTracks > 0); assert.equal(log.ended, 1);
});
