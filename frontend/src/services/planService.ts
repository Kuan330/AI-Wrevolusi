import { api } from './api';
import { demoPlan, validateEvent, type PlanState } from '@/pages/Plan/planModel';
export interface PlanRepository {
    load(): Promise<PlanState>;
    save(state: PlanState, expectedRevision: number): Promise<PlanState>;
}
function checked(value: unknown): PlanState {
    const state = value as PlanState;
    if (!state || state.version !== 1 || !Number.isInteger(state.revision) || !Array.isArray(state.events) || state.events.some(e => !e || typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.start !== 'string' || typeof e.end !== 'string' || !['learning', 'work', 'care', 'personal'].includes(e.kind) || typeof e.completed !== 'boolean' || typeof e.flexible !== 'boolean' || typeof e.shareable !== 'boolean' || validateEvent(e) || (e.assistance && (!['draft', 'pending', 'accepted', 'declined'].includes(e.assistance.status) || typeof e.assistance.name !== 'string' || typeof e.assistance.message !== 'string'))) || new Set(state.events.map(e => e.id)).size !== state.events.length)
        throw new Error('Saved plan could not be read. Your stored data has not been overwritten.');
    return state;
}
// Reserved API contract; local storage remains the default until a server implements it.
export const remotePlanRepository: PlanRepository = {
    load: async () => checked(await api.get<PlanState>('/planner/state')),
    save: async (state, expectedRevision) => checked(await api.patch<PlanState>('/planner/state', { ...state, expectedRevision })),
};
export function localPlanRepository(demo = false): PlanRepository {
    const key = demo ? 'aiwrevolusi.planner.demo.v1' : 'aiwrevolusi.planner.v1';
    const read = () => { const raw = localStorage.getItem(key); return raw ? checked(JSON.parse(raw)) : demo ? demoPlan() : { version: 1 as const, revision: 0, events: [] }; };
    return { load: async () => read(), save: async (state, expectedRevision) => { const current = read(); if (current.revision !== expectedRevision)
            throw new Error('Your plan changed in another tab. Reload before saving.'); const next = checked({ ...state, revision: expectedRevision + 1 }); localStorage.setItem(key, JSON.stringify(next)); return next; } };
}
