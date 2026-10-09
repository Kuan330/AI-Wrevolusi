/** Voice answers use the browser's built-in speech recognition. We never record or keep audio ourselves. */
type RecognitionEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type RecognitionConstructor = new () => Recognition;

export const speechSupported = (scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>): boolean =>
  Boolean(scope.SpeechRecognition ?? scope.webkitSpeechRecognition);

const REASONS: Record<string, string> = {
  "not-allowed": "Microphone permission was not given. You can type your answer instead.",
  "service-not-allowed": "Your browser does not allow speech recognition here. You can type your answer instead.",
  "no-speech": "We did not hear anything. Try again or type your answer.",
  "audio-capture": "No microphone was found. You can type your answer instead.",
  network: "Speech recognition needs a connection. You can type your answer instead.",
};
export const speechErrorMessage = (code: string) => REASONS[code] ?? "Voice input stopped. You can try again or type your answer.";

export type SpeechSession = { stop: () => void; cancel: () => void };
/** Start listening. `stop` keeps what was heard; `cancel` throws it away. Either way recording ends and nothing is stored. */
export function startSpeech(handlers: { onText: (text: string) => void; onError: (message: string) => void; onEnd: () => void }, lang = "en-MY"): SpeechSession | null {
  const scope = globalThis as unknown as Record<string, RecognitionConstructor | undefined>;
  const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = lang; recognition.continuous = true; recognition.interimResults = true;
  let final = "", cancelled = false, ended = false;
  const finish = () => { if (!ended) { ended = true; handlers.onEnd(); } };
  recognition.onresult = event => {
    if (cancelled) return;
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const result = event.results[index], piece = result[0]?.transcript ?? "";
      if (result.isFinal) final += `${piece} `; else interim += piece;
    }
    handlers.onText(`${final}${interim}`.replace(/\s+/g, " ").trim());
  };
  recognition.onerror = event => { if (!cancelled && event.error !== "aborted") handlers.onError(speechErrorMessage(event.error)); };
  recognition.onend = finish;
  try { recognition.start(); } catch { handlers.onError(speechErrorMessage("")); finish(); return null; }
  return { stop: () => recognition.stop(), cancel: () => { cancelled = true; try { recognition.abort(); } catch { /* already stopped */ } finish(); } };
}
