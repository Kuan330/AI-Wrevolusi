import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/form-field";
import { speechSupported, startSpeech, tidyTranscript, voiceBlockedBy, type SpeechSession } from "@/features/interview/speech";
import { audioRecordingSupported, startAudioRecording } from "@/features/interview/audioRecording";
import { interviewService } from "@/features/interview/service";

type Props = { value: string; onChange: (value: string) => void; onSubmit: (mode: "text" | "voice") => void; busy: boolean };
export default function AnswerBox({ value, onChange, onSubmit, busy }: Props) {
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [recording, setRecording] = useState(false), [note, setNote] = useState(""), [spoken, setSpoken] = useState(false);
  const [listening, setListening] = useState(false);
  const [serverVoice, setServerVoice] = useState<boolean | null>(null), [processing, setProcessing] = useState(false);
  // A voice problem is shown beside the Type and Speak choice, where the user just acted, not under the answer box.
  const [voiceNote, setVoiceNote] = useState(""), [blocked, setBlocked] = useState(false);
  const session = useRef<SpeechSession | null>(null), base = useRef("");
  const audioRequest = useRef<AbortController | null>(null);
  // While speaking, the live text stays here and is shown at most once per frame. The saved draft only changes on finished phrases and at the end.
  const [live, setLive] = useState<string | null>(null), [seconds, setSeconds] = useState(0);
  const frame = useRef(0), pending = useRef(""), committed = useRef(""), cancelled = useRef(false);
  const join = (text: string) => [base.current, text].filter(Boolean).join(" ");
  const canSpeak = serverVoice !== null && (serverVoice ? audioRecordingSupported() : speechSupported() && !blocked);
  // Recording always ends when the user leaves this screen.
  useEffect(() => {
    const controller = new AbortController();
    interviewService.transcriptionCapabilities(controller.signal).then(result => { if (!controller.signal.aborted) setServerVoice(result.configured === true); }).catch(() => { if (!controller.signal.aborted) setServerVoice(false); });
    return () => { controller.abort(); cancelled.current = true; cancelAnimationFrame(frame.current); audioRequest.current?.abort(); session.current?.cancel(); };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const started = Date.now(), timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  const begin = async () => {
    setNote(""); setVoiceNote(""); base.current = value.trim(); committed.current = ""; cancelled.current = false; setSeconds(0); setListening(false); setProcessing(false);
    const handlers = {
      onListening: setListening,
      onText: (text: string, done: string) => {
        const heard = join(tidyTranscript(text));
        pending.current = heard.slice(0, 4000);
        if (heard.length > 4000) setVoiceNote("The answer reached 4,000 characters. Extra words were not added. Shorten your answer before recording more.");
        if (text.trim()) setSpoken(true);
        if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setLive(pending.current); });
        if (done !== committed.current) { committed.current = done; onChange(join(tidyTranscript(done)).slice(0, 4000)); }
      },
      onError: (message: string, code: string) => { setVoiceNote(message); if (voiceBlockedBy(code)) { setBlocked(true); setMode("text"); } },
      onEnd: () => {
        session.current = null; audioRequest.current = null; cancelAnimationFrame(frame.current); frame.current = 0; setRecording(false); setProcessing(false); setLive(null);
        // Keep what was heard, with a full stop at the end. A cancel has already put the old text back.
        if (!cancelled.current && committed.current) onChange(join(tidyTranscript(committed.current, true)).slice(0, 4000));
      },
    };
    if (serverVoice) {
      const controller = new AbortController(); audioRequest.current = controller; setRecording(true);
      const started = await startAudioRecording({ ...handlers, transcribe: interviewService.transcribe, onProcessing: () => setProcessing(true) }, controller.signal);
      if (!controller.signal.aborted && !cancelled.current) session.current = started;
    } else {
      const started = startSpeech(handlers);
      if (started) { session.current = started; setRecording(true); }
    }
  };
  const cancel = () => { cancelled.current = true; audioRequest.current?.abort(); session.current?.cancel(); onChange(base.current); setSpoken(false); };
  const submit = () => {
    if (!value.trim()) { setNote("Add your answer before you submit."); return; }
    setNote(""); onSubmit(mode === "voice" && spoken ? "voice" : "text");
  };
  return <div className="ip-answer">
    <div className="ip-mode" role="group" aria-label="How do you want to answer?">
      <Button type="button" size="sm" variant={mode === "text" ? "secondary" : "ghost"} aria-pressed={mode === "text"} disabled={recording} onClick={() => setMode("text")}>Type</Button>
      <Button type="button" size="sm" variant={mode === "voice" ? "secondary" : "ghost"} aria-pressed={mode === "voice"} disabled={recording || !canSpeak} onClick={() => setMode("voice")}>Speak</Button>
      {!canSpeak && <span className="ip-hint">{serverVoice === null ? "Checking voice input…" : blocked ? "Voice typing is not working in this browser right now." : "Voice is not available in this browser. You can type your answer."}</span>}
    </div>
    {voiceNote && <p className="ip-note" role="alert">{voiceNote}</p>}
    {mode === "voice" && <div className="ip-voice">
      <p className="ip-hint">{serverVoice ? "Record up to two minutes in English. Stop sends your audio to the transcription service. The two-minute limit also stops and transcribes it. Cancel discards it. We do not save your audio, but the provider’s data policy applies." : "When you speak, your browser turns your voice into English text. Voice typing is English only. We do not record or keep your audio, but your browser may send it to its own speech service."} You can check and change the text before you submit.</p>
      <div className="ip-voice-actions">
        {recording ? <>
          <span className="ip-recording" role="status"><span aria-hidden="true" className="ip-dot" />{processing ? "Transcribing your recording…" : listening ? "Recording. Speak now." : "Starting microphone…"}</span>
          <span className="ip-hint" aria-hidden="true">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} · {(live ?? value).trim() ? (live ?? value).trim().split(/\s+/).length : 0} words</span>
          {!processing && <Button type="button" size="sm" onClick={() => session.current?.stop()} disabled={!listening}><Square size={14} />Stop</Button>}
          <Button type="button" size="sm" variant="outline" onClick={cancel}><X size={14} />Cancel</Button>
        </> : <Button type="button" size="sm" onClick={() => { void begin(); }} disabled={busy}><Mic size={14} />{spoken ? "Record again" : "Start recording"}</Button>}
      </div>
    </div>}
    <p className="ip-tip">Tip: write three to five sentences. Say what happened, what you did, and what changed. Speaking is fine too.</p>
    <FormField label={mode === "voice" ? "Your transcript. Check it and fix any mistakes." : "Your answer"}>
      <Textarea rows={7} maxLength={4000} value={recording && live !== null ? live : value} disabled={busy} readOnly={recording} aria-label="Your answer" placeholder="Type what you would say in the interview…" onChange={event => { onChange(event.target.value); setNote(""); }} />
    </FormField>
    {note && <p className="ip-note" role="alert">{note}</p>}
    <div className="ip-actions"><Button type="button" disabled={busy || recording} onClick={submit}>{busy ? "Getting feedback…" : "Submit answer"}</Button><span className="ip-hint">{value.trim() ? `${value.trim().split(/\s+/).length} words. ` : ""}Nothing is sent for feedback until you submit.</span></div>
  </div>;
}
