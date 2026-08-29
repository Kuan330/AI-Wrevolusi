import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { buildChanges, seedCaps, withDisplayNos } from "../domain/profile";
import { listWefSkills } from "../api/wef";
import { Toast } from "../components/Toast";
import { emptyCascade } from "../features/e1/OccupationCascade";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [cascade, setCascade] = useState(emptyCascade);
  const [occupation, setOccupation] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [changes, setChanges] = useState({});
  const [caps, setCaps] = useState([]);
  const [wefCatalog, setWefCatalog] = useState([]);
  const [profileConfirmed, setProfileConfirmed] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  const ensureWefCatalog = useCallback(async () => {
    if (wefCatalog.length) return wefCatalog;
    try {
      const rows = await listWefSkills();
      setWefCatalog(rows);
      return rows;
    } catch {
      setWefCatalog([]);
      return [];
    }
  }, [wefCatalog]);

  const resetMatch = useCallback(() => {
    setCascade(emptyCascade());
    setOccupation(null);
    setTasks([]);
    setChanges({});
    setCaps([]);
    setProfileConfirmed(false);
  }, []);

  const confirmProfile = useCallback(
    async (taskList) => {
      const source = Array.isArray(taskList) ? taskList : tasks;
      const numbered = withDisplayNos(source);
      setTasks(numbered);
      setChanges((prev) => buildChanges(numbered, prev));
      const catalog = await ensureWefCatalog();
      setCaps((prev) => (prev.length ? prev : seedCaps(catalog)));
      setProfileConfirmed(true);
    },
    [tasks, ensureWefCatalog]
  );

  const value = useMemo(
    () => ({
      cascade,
      setCascade,
      occupation,
      setOccupation,
      tasks,
      setTasks,
      changes,
      setChanges,
      caps,
      setCaps,
      wefCatalog,
      profileConfirmed,
      setProfileConfirmed,
      showToast,
      ensureWefCatalog,
      resetMatch,
      confirmProfile,
    }),
    [
      cascade,
      occupation,
      tasks,
      changes,
      caps,
      wefCatalog,
      profileConfirmed,
      showToast,
      ensureWefCatalog,
      resetMatch,
      confirmProfile,
    ]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Toast message={toast} />
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
