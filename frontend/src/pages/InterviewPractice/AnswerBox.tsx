import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/form-field";
import { speechSupported, startSpeech, type SpeechSession } from "@/features/interview/speech";

type Props = { value: string; onChange: (value: string) => void; onSubmit: (mode: "text" | "voice") => void; busy: boolean };
export default function AnswerBox({ value, onChange, onSubmit, busy }: Props) {
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [recording, setRecording] = useState(false), [note, setNote] = useState(""), [spoken, setSpoken] = useState(false);
  const session = useRef<SpeechSession | null>(null), base = useRef("");
  const canSpeak = speechSupported();
  // Recording always ends when the user leaves this screen.
  useEffect(() => () => session.current?.cancel(), []);
  const begin = () => {
    setNote(""); base.current = value.trim();
    const started = startSpeech({
      onText: text => { onChange([base.current, text].filter(Boolean).join(" ")); setSpoken(true); },
      onError: setNote,
      onEnd: () => { session.current = null; setRecording(false); },
    });
    if (started) { session.current = started; setRecording(true); }
  };
  const cancel = () => { session.current?.cancel(); onChange(base.current); setSpoken(false); };
  const submit = () => {
    if (!value.trim()) { setNote("Add your answer before you submit."); return; }
    setNote(""); onSubmit(mode === "voice" && spoken ? "voice" : "text");
  };
  return <div className="ip-answer">
    <div className="ip-mode" role="group" aria-label="How do you want to answer?">
      <Button type="button" size="sm" variant={mode === "text" ? "secondary" : "ghost"} aria-pressed={mode === "text"} disabled={recording} onClick={() => setMode("text")}>Type</Button>
      <Button type="button" size="sm" variant={mode === "voice" ? "secondary" : "ghost"} aria-pressed={mode === "voice"} disabled={recording || !canSpeak} onClick={() => setMode("voice")}>Speak</Button>
      {!canSpeak && <span className="ip-hint">Voice is not available in this browser. You can type your answer.</span>}
    </div>
    {mode === "voice" && <div className="ip-voice">
      <p className="ip-hint">When you speak, your browser turns your voice into text. We do not record or keep your audio, but your browser may send it to its own speech service. You can check and change the text before you submit.</p>
      <div className="ip-voice-actions">
        {recording ? <>
          <span className="ip-recording" role="status"><span aria-hidden="true" className="ip-dot" />Recording. Speak now.</span>
          <Button type="button" size="sm" onClick={() => session.current?.stop()}><Square size={14} />Stop</Button>
          <Button type="button" size="sm" variant="outline" onClick={cancel}><X size={14} />Cancel</Button>
        </> : <Button type="button" size="sm" onClick={begin} disabled={busy}><Mic size={14} />{spoken ? "Record again" : "Start recording"}</Button>}
      </div>
    </div>}
    <FormField label={mode === "voice" ? "Your transcript. Check it and fix any mistakes." : "Your answer"}>
      <Textarea rows={7} maxLength={4000} value={value} disabled={busy} readOnly={recording} aria-label="Your answer" placeholder="Type what you would say in the interview…" onChange={event => { onChange(event.target.value); setNote(""); }} />
    </FormField>
    {note && <p className="ip-note" role="alert">{note}</p>}
    <div className="ip-actions"><Button type="button" disabled={busy || recording} onClick={submit}>{busy ? "Getting feedback…" : "Submit answer"}</Button><span className="ip-hint">Nothing is sent for feedback until you submit.</span></div>
  </div>;
}
