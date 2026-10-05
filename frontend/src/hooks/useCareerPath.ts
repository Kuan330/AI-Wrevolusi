import { useEffect, useState } from "react";
import { possibilitiesService } from "@/services/possibilitiesService";
import { accountStorage, currentWorkspaceSession } from "@/services/accountStorage";
import { CHOSEN_DIRECTION_KEY, careerPathProgress, parseChosenDirection } from "@/features/dashboard/careerPath";

type CareerPath = ReturnType<typeof careerPathProgress> & { occupationCode: string };

const readChoice = () => {
  try { return parseChosenDirection(accountStorage.getItem(CHOSEN_DIRECTION_KEY)); } catch { return null; }
};

/** Progress towards the career direction chosen in Possibilities; null until one is chosen and loaded. */
export function useCareerPath() {
  const [choice, setChoice] = useState(readChoice);
  const [path, setPath] = useState<CareerPath | null>(null);

  useEffect(() => {
    const update = () => setChoice(current => {
      const next = readChoice();
      return current?.occupationCode === next?.occupationCode && current?.skillId === next?.skillId ? current : next;
    });
    window.addEventListener("workspace-change", update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener("workspace-change", update); window.removeEventListener("focus", update); };
  }, []);

  useEffect(() => {
    if (!choice) return;
    const controller = new AbortController();
    const owner = currentWorkspaceSession();
    possibilitiesService.getPossibilities(controller.signal).then(response => {
      if (controller.signal.aborted || owner !== currentWorkspaceSession()) return;
      const direction = response.status === "ready" ? response.directions.find(item => item.occupation_code === choice.occupationCode) : undefined;
      setPath(direction ? { occupationCode: direction.occupation_code, ...careerPathProgress(direction, choice.skillId) } : null);
    }).catch(() => { if (!controller.signal.aborted) setPath(null); });
    return () => controller.abort();
  }, [choice]);

  return choice ? path : null;
}
