import { speechErrorMessage, type SpeechSession, type startSpeech } from "./speech.ts";

export const MAX_RECORDING_MS = 120000;
export const MAX_AUDIO_BYTES = 3000000;
const FORMATS = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
export const audioRecordingSupported = () => Boolean(globalThis.navigator?.mediaDevices && typeof MediaRecorder !== "undefined" && FORMATS.some(type => MediaRecorder.isTypeSupported(type)));

/** Audio stays in memory. Stop transcribes it; Cancel discards it and aborts any request. */
export async function startAudioRecording(handlers: Parameters<typeof startSpeech>[0] & {
  transcribe: (audio: Blob, signal: AbortSignal) => Promise<string>;
  onProcessing: () => void;
}, signal: AbortSignal): Promise<SpeechSession | null> {
  let stream: MediaStream | undefined, recorder: MediaRecorder | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let chunks: Blob[] = [], bytes = 0, discarded = false, ended = false;
  const release = () => { clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); handlers.onListening?.(false); };
  const finish = () => { if (!ended) { ended = true; chunks = []; release(); signal.removeEventListener("abort", cancel); handlers.onEnd(); } };
  const cancel = () => { if (ended) return; discarded = true; release(); if (recorder?.state === "recording") recorder.stop(); finish(); };
  const fail = (message: string) => { discarded = true; handlers.onError(message, "recording"); cancel(); };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) { cancel(); return null; }
  try {
    const mimeType = FORMATS.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error("unsupported");
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (signal.aborted || ended) { stream.getTracks().forEach(track => track.stop()); return null; }
    recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
    recorder.onstart = () => { if (!ended) handlers.onListening?.(true); };
    recorder.ondataavailable = event => {
      if (discarded || ended || !event.data.size) return;
      bytes += event.data.size;
      if (bytes > MAX_AUDIO_BYTES) { fail("This recording is too large. Try a shorter answer."); return; }
      chunks.push(event.data);
    };
    recorder.onerror = () => { if (!ended && !discarded) fail("Recording stopped unexpectedly. Your earlier answer is kept. Try again."); };
    recorder.onstop = async () => {
      if (discarded || ended || signal.aborted) { finish(); return; }
      release();
      if (!bytes) { fail("No audio was captured. Check your microphone and try again."); return; }
      const audio = new Blob(chunks, { type: recorder!.mimeType });
      chunks = [];
      handlers.onProcessing();
      try {
        const text = await handlers.transcribe(audio, signal);
        if (!signal.aborted && !ended) handlers.onText(text, text);
      } catch (error) {
        if (!signal.aborted && !ended) handlers.onError(error instanceof Error ? error.message : "Transcription failed. Your earlier answer is kept. Try again.", "transcription");
      } finally { finish(); }
    };
    recorder.start(1000);
    const stop = () => { if (recorder?.state === "recording") recorder.stop(); };
    timer = setTimeout(stop, MAX_RECORDING_MS);
    return { stop, cancel };
  } catch (error) {
    if (!signal.aborted && !ended) {
      const name = error instanceof Error ? error.name : "";
      const code = name === "NotAllowedError" ? "not-allowed" : name === "NotFoundError" ? "audio-capture" : "recording";
      handlers.onError(code === "recording" ? "Audio recording is not available in this browser. You can type your answer." : speechErrorMessage(code), code);
    }
    finish(); return null;
  }
}
