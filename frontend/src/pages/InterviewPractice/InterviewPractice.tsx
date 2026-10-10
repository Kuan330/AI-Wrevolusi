import { useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { useAccount } from "@/components/account/useAccount";
import { useInterviewSessions } from "@/features/interview/useInterviewSessions";
import SessionView from "./SessionView";
import StartPanel from "./StartPanel";
import "./interview.css";

export default function InterviewPractice() {
  const { user } = useAccount();
  return user ? <Practice key={user.id} owner={user.id} /> : null;
}
function Practice({ owner }: { owner: string }) {
  const store = useInterviewSessions(owner);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = store.sessions.find(session => session.id === activeId) ?? null;
  return <div className="ip-page">
    <PageHeader title="Practise for your interview" description={active ? undefined : "Practise for your future occupation or use your reviewed resume. Your answers stay on this device."} actions={store.saveStatus ? <span className="ip-save" role="status">{store.saveStatus}</span> : undefined} />
    {store.error && <div className="ip-note" role="alert">{store.error}</div>}
    {store.loading ? <p role="status">Loading your saved practice…</p> : active
      ? <SessionView key={active.id} owner={owner} session={active} onChange={session => { void store.save(session); }} onExit={() => setActiveId(null)} />
      : <StartPanel owner={owner} sessions={store.sessions} onStart={session => { void store.save(session); setActiveId(session.id); }} onOpen={setActiveId} onDelete={store.remove} />}
  </div>;
}
