/** Voice answers use the browser's built-in speech recognition, in English only. We never record or keep audio ourselves. */
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
  network: "Voice typing could not reach its speech service. Check your connection, or try Chrome or Edge. Some browsers, such as Brave, block it. You can type your answer instead.",
};
/** These errors will not go away on a retry in the same browser, so voice is switched off for this visit. */
export const voiceBlockedBy = (code: string) => code === "network" || code === "service-not-allowed";
export const speechErrorMessage = (code: string) => REASONS[code] ?? "Voice input stopped. You can try again or type your answer.";

export type SpeechSession = { stop: () => void; cancel: () => void };
/** The browser may end a live session early on a pause or a network hiccup. We restart it a few times so a long answer is not cut off. */
export const MAX_RESTARTS = 5;

/**
 * Light clean-up for a spoken transcript: browsers return plain lowercase text.
 * It capitalises the first word and the pronoun "I", and adds a full stop at the end when asked. It never adds or removes words.
 */
export function tidyTranscript(text: string, finished = false): string {
  let out = text.replace(/\s+/g, " ").trim();
  if (!out) return "";
  out = out.replace(/\bi(?=$|[\s,.!?'’])/g, "I").replace(/^[a-z]/, letter => letter.toUpperCase());
  return finished && !/[.!?]$/.test(out) ? `${out}.` : out;
}

/**
 * Start listening in English. `onText` gets everything heard so far and the part the browser has finished.
 * `stop` keeps what was heard; `cancel` throws it away. Either way recording ends and nothing is stored.
 */
export function startSpeech(handlers: { onText: (text: string, committed: string) => void; onError: (message: string, code: string) => void; onEnd: () => void }, lang = "en-MY"): SpeechSession | null {
  const scope = globalThis as unknown as Record<string, RecognitionConstructor | undefined>;
  const Ctor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Ctor) return null;
  let final = "", cancelled = false, stopping = false, ended = false, failed = false, retryLanguage = false, restarts = 0, language = lang;
  let recognition!: Recognition;
  const finish = () => { if (!ended) { ended = true; handlers.onEnd(); } };
  const create = () => {
    const next = new Ctor();
    next.lang = language; next.continuous = true; next.interimResults = true;
    next.onresult = event => {
      if (cancelled) return;
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index], piece = result[0]?.transcript ?? "";
        if (result.isFinal) final += `${piece} `; else interim += piece;
      }
      handlers.onText(`${final}${interim}`.replace(/\s+/g, " ").trim(), final.replace(/\s+/g, " ").trim());
    };
    next.onerror = event => {
      if (cancelled || event.error === "aborted") return;
      // Some browsers have no Malaysian English model. Use general English instead of failing.
      if (event.error === "language-not-supported" && language !== "en-US") { language = "en-US"; retryLanguage = true; return; }
      // A long pause after speaking is the end of the answer, not a problem.
      if (event.error === "no-speech" && final) { failed = true; return; }
      failed = true; handlers.onError(speechErrorMessage(event.error), event.error);
    };
    next.onend = () => {
      if (cancelled || stopping || ended) { finish(); return; }
      if (retryLanguage) { retryLanguage = false; try { recognition = create(); recognition.start(); return; } catch { /* fall through */ } }
      if (!failed && restarts < MAX_RESTARTS) { restarts += 1; try { recognition = create(); recognition.start(); return; } catch { /* fall through */ } }
      finish();
    };
    return next;
  };
  recognition = create();
  try { recognition.start(); } catch { handlers.onError(speechErrorMessage(""), ""); finish(); return null; }
  return {
    stop: () => { stopping = true; try { recognition.stop(); } catch { finish(); } },
    cancel: () => { cancelled = true; try { recognition.abort(); } catch { /* already stopped */ } finish(); },
  };
}
