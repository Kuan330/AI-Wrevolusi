import { useEffect, useRef, useState } from "react";
import { useAccount } from "../../components/account/useAccount";
import { currentWorkspaceSession } from "../../services/accountStorage.ts";
import { importResume, isResumeFile } from "./importResume.ts";
import { saveImportedResume } from "./repository.ts";

/** Shares the existing My Plan file control, without adding CVs to synced resources. */
export function useResumeAttachment() {
  const { user } = useAccount();
  const [notice, setNotice] = useState({ owner: user?.id ?? "", text: "" });
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, [user?.id]);
  const attach = async (file: File): Promise<boolean> => {
    if (!isResumeFile(file)) return false;
    if (!user) throw new Error("Sign in before attaching a resume.");
    const owner = user.id, session = currentWorkspaceSession();
    const controller = new AbortController();
    active.current?.abort(); active.current = controller;
    const source = await importResume(file, controller.signal);
    await saveImportedResume(owner, source, () => !controller.signal.aborted && session === currentWorkspaceSession());
    if (!controller.signal.aborted && session === currentWorkspaceSession()) setNotice({ owner, text: `${file.name} saved locally for Resume builder. It is not a learning reference or part of plan sync.` });
    return true;
  };
  return { attach, notice: notice.owner === user?.id ? notice.text : "" };
}
