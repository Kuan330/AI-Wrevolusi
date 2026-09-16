import { accountStorage } from "@/infrastructure/storage/accountStorage";
import { browserStorage } from "@/infrastructure/storage/browserStorage";
import { STORAGE_KEYS } from "@/infrastructure/storage/keys";
import { api } from "@/services/api";
import {
  demoPlan,
  validateEvent,
  type PlanState,
} from "@/features/planning/planModel";
export interface PlanRepository {
  load(): Promise<PlanState>;
  save(state: PlanState, expectedRevision: number): Promise<PlanState>;
}
function checked(value: unknown): PlanState {
  const state = value as PlanState;
  if (
    !state ||
    state.version !== 1 ||
    !Number.isInteger(state.revision) ||
    !Array.isArray(state.events) ||
    state.events.some(
      (e) =>
        !e ||
        typeof e.id !== "string" ||
        typeof e.title !== "string" ||
        typeof e.start !== "string" ||
        typeof e.end !== "string" ||
        !["learning", "work", "care", "personal"].includes(e.kind) ||
        typeof e.completed !== "boolean" ||
        typeof e.flexible !== "boolean" ||
        typeof e.shareable !== "boolean" ||
        validateEvent(e) ||
        (e.assistance &&
          (!["draft", "pending", "accepted", "declined"].includes(
            e.assistance.status,
          ) ||
            typeof e.assistance.name !== "string" ||
            typeof e.assistance.message !== "string")),
    ) ||
    new Set(state.events.map((e) => e.id)).size !== state.events.length
  )
    throw new Error(
      "Saved plan could not be read. Your stored data has not been overwritten.",
    );
  return state;
}
// Reserved API contract; local storage remains the default until a server implements it.
export const remotePlanRepository: PlanRepository = {
  load: async () => checked(await api.get<PlanState>("/planner/state")),
  save: async (state, expectedRevision) =>
    checked(
      await api.patch<PlanState>("/planner/state", {
        ...state,
        expectedRevision,
      }),
    ),
};
export function localPlanRepository(demo = false): PlanRepository {
  const storage = demo ? browserStorage : accountStorage;
  const key = demo ? STORAGE_KEYS.demoPlanner : STORAGE_KEYS.planner;
  const context = accountStorage.getItem(STORAGE_KEYS.confirmedAnalysis) ?? "";
  const read = () => {
    const raw = storage.getItem(key);
    if (!raw)
      return demo
        ? demoPlan()
        : { version: 1 as const, revision: 0, context, events: [] };
    const state = checked(JSON.parse(raw));
    return !demo && state.context !== context
      ? { version: 1 as const, revision: 0, context, events: [] }
      : state;
  };
  return {
    load: async () => read(),
    save: async (state, expectedRevision) => {
      const current = read();
      if (current.revision !== expectedRevision)
        throw new Error(
          "Your plan changed in another tab. Reload before saving.",
        );
      const next = checked({ ...state, revision: expectedRevision + 1 });
      storage.setItem(key, JSON.stringify(next));
      return next;
    },
  };
}
