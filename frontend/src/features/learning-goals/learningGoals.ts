import { accountStorage, commitWorkspaceItems, currentWorkspaceSession } from "../../services/accountStorage.ts";
import { readJourneyProfile, readJourneyState, readLearningContext, learningContextNeedsReview, personalSkillIsCurrent } from "../journey/journey.ts";
import type { LearningContext, PersonalSkill } from "../journey/journey.ts";
import { readSpecialistState, specialistEntryKey, specialistEntryIsCurrent } from "../journey/specialistSkills.ts";
import type { SpecialistEntry } from "../journey/specialistSkills.ts";

export const LEARNING_GOALS_KEY = "aiwrevolusi.learningGoals.v1";
export type GoalTask = { id: string; wording: string };
export type GoalAction = { kind: "understand" | "practise" | "find_learning"; text: string; origin?: "ai_suggestion" | "template" };
export type AttemptType = "study" | "course_practice" | "workplace_practice";
export type LearningAttempt = { id: string; date: string; type: AttemptType; description: string; notes: string; task: GoalTask | null; createdAt: string; updatedAt: string };
export type GoalSnapshot = {
  skill: { source: "esco" | "wef" | "personal"; id: string; label: string; sourceVersion: string | null };
  decision: string | null; tasks: GoalTask[]; occupationCode: string | null;
  sourceOccupationUri: string | null; career: { code: string; title: string } | null;
  origin: "work" | "career" | "browse"; workKey: string | null; wording: string;
};
export type GoalHistory = { revision: number; recordedAt: string; wording: string; action: GoalAction | null; attempts: LearningAttempt[] };
export type LearningGoal = { id: string; sourceKey: string; createdAt: string; initial: GoalSnapshot; wording: string; action: GoalAction | null; attempts: LearningAttempt[]; history: GoalHistory[]; revision: number; needsReview: boolean; updatedAt: string };
export type AttemptInput = { id?: string; date: string; type: AttemptType; description: string; notes?: string; task?: GoalTask | null };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && v.length <= max && (empty || !!v.trim());
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const dated = (v: unknown) => str(v, 40) && Number.isFinite(Date.parse(v));
const taskValid = (v: unknown): v is GoalTask => obj(v) && keys(v,["id","wording"]) && str(v.id,200) && str(v.wording,5000);
const actionValid = (v: unknown) => v === null || (obj(v) && Object.keys(v).every(key => ["kind", "text", "origin"].includes(key)) && (v.origin === undefined || v.origin === "ai_suggestion" || v.origin === "template") && typeof v.kind === "string" && ["understand","practise","find_learning"].includes(v.kind) && str(v.text,1000));
function attemptValid(v: unknown): v is LearningAttempt {
  return obj(v) && keys(v,["id","date","type","description","notes","task","createdAt","updatedAt"]) && str(v.id,100) &&
    str(v.date,10) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && Number.isFinite(Date.parse(v.date)) && new Date(v.date).toISOString().slice(0,10) === v.date &&
    typeof v.type === "string" && ["study","course_practice","workplace_practice"].includes(v.type) && str(v.description,2000) && str(v.notes,4000,true) &&
    (v.type === "workplace_practice" ? taskValid(v.task) : v.task === null) && dated(v.createdAt) && dated(v.updatedAt);
}
function attemptsValid(v: unknown): v is LearningAttempt[] { return Array.isArray(v) && v.length <= 200 && v.every(attemptValid) && new Set(v.map(a=>a.id)).size === v.length; }
function snapshotValid(v: unknown): v is GoalSnapshot {
  if (!obj(v) || !keys(v,["skill","decision","tasks","occupationCode","sourceOccupationUri","career","origin","workKey","wording"]) || !obj(v.skill)) return false;
  const s = v.skill;
  return keys(s,["source","id","label","sourceVersion"]) && typeof s.source === "string" && ["esco","wef","personal"].includes(s.source) && str(s.id,200) &&
    (s.source === "esco" ? /^http:\/\/data\.europa\.eu\/esco\/skill\/[0-9a-f-]{36}$/.test(s.id) && str(s.sourceVersion,40) : s.source === "wef" ? /^[1-9]\d*$/.test(s.id) && s.sourceVersion === null : str(s.id,100) && s.sourceVersion === null) && str(s.label,300) &&
    (v.decision === null || (typeof v.decision === "string" && ["use","no","unsure","accepted","rejected"].includes(v.decision))) && Array.isArray(v.tasks) && v.tasks.length <= 100 && v.tasks.every(taskValid) &&
    (v.occupationCode === null || str(v.occupationCode,40)) && (v.sourceOccupationUri === null || (str(v.sourceOccupationUri,200) && /^http:\/\/data\.europa\.eu\/esco\/occupation\/[0-9a-f-]{36}$/.test(v.sourceOccupationUri))) &&
    (v.career === null || (obj(v.career) && keys(v.career,["code","title"]) && str(v.career.code,40) && str(v.career.title,200))) &&
    typeof v.origin === "string" && ["work","career","browse"].includes(v.origin) && (v.origin !== "career" || v.career !== null) && (v.workKey === null || str(v.workKey,100000,true)) && str(v.wording,1000);
}
export function parseLearningGoals(raw: string | null): LearningGoal[] {
  if (raw === null) return [];
  try {
    const state: unknown = JSON.parse(raw);
    if (!obj(state) || !keys(state,["version","goals"]) || state.version !== 1 || !Array.isArray(state.goals) || state.goals.length > 100) throw Error();
    for (const g of state.goals) {
      if (!obj(g) || !keys(g,["id","sourceKey","createdAt","initial","wording","action","attempts","history","revision","needsReview","updatedAt"]) || !str(g.id,100) || !str(g.sourceKey,500) || !dated(g.createdAt) || !dated(g.updatedAt) || !snapshotValid(g.initial) || !str(g.wording,1000) || !actionValid(g.action) || !attemptsValid(g.attempts) || !Number.isSafeInteger(g.revision) || Number(g.revision)<1 || typeof g.needsReview !== "boolean" || !Array.isArray(g.history) || g.history.length !== Number(g.revision)-1 || g.history.length > 200) throw Error();
      for (const [i,h] of g.history.entries()) if (!obj(h) || !keys(h,["revision","recordedAt","wording","action","attempts"]) || h.revision !== i+1 || !dated(h.recordedAt) || !str(h.wording,1000) || !actionValid(h.action) || !attemptsValid(h.attempts)) throw Error();
    }
    if (new Set(state.goals.map(g=>g.id)).size !== state.goals.length) throw Error();
    return state.goals as LearningGoal[];
  } catch { throw Error("Your saved goals could not be read. Reload your saved account before making changes. Your records have been kept."); }
}
export const readLearningGoals = () => parseLearningGoals(accountStorage.getItem(LEARNING_GOALS_KEY));
let savingOwner: number | null = null;
async function persist(goals: LearningGoal[]) {
  const owner = currentWorkspaceSession();
  if (savingOwner === owner) throw Error("A goal is being saved. Please wait.");
  savingOwner = owner;
  try { const raw=JSON.stringify({version:1,goals}); parseLearningGoals(raw); await commitWorkspaceItems({[LEARNING_GOALS_KEY]:raw}); }
  finally { if (savingOwner === owner) savingOwner=null; }
}
const same = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
async function create(sourceKey: string, initial: GoalSnapshot, newGoal = false): Promise<LearningGoal> {
  const goals=readLearningGoals();
  const matching=goals.find(g=>g.sourceKey===sourceKey && same(g.initial,initial));
  if (matching) return matching;
  if (!newGoal && goals.some(g=>g.sourceKey===sourceKey)) throw Error("This source has changed. Open your existing goal or explicitly start a new goal to keep a new starting record.");
  const now=new Date().toISOString();
  const goal: LearningGoal={id:crypto.randomUUID(),sourceKey,initial,createdAt:now,updatedAt:now,wording:initial.wording,action:null,attempts:[],history:[],revision:1,needsReview:false};
  await persist([...goals,goal]); return goal;
}
export async function createSpecialistGoal(entry: SpecialistEntry, options: {newGoal?:boolean} = {}) {
  const saved=readSpecialistState().entries.find(e=>specialistEntryKey(e)===specialistEntryKey(entry));
  if (!saved || !same(saved,entry) || !saved.wantsLearning) throw Error("Choose a saved learning interest first.");
  const p=readJourneyProfile();
  if (!p.tasksConfirmed || !specialistEntryIsCurrent(entry,p.tasks,p.tasksOccupationCode)) throw Error("Your work changed. Review the saved skill choice first.");
  return create(`specialist:${specialistEntryKey(entry)}`,{skill:{source:"esco",id:entry.skillUri,label:entry.skillLabel,sourceVersion:entry.sourceVersion},decision:entry.decision,tasks:[{id:entry.taskId,wording:entry.taskWording}],occupationCode:entry.occupationCode,sourceOccupationUri:entry.sourceOccupationUri??null,career:null,origin:"work",workKey:null,wording:`Develop ${entry.skillLabel}`},options.newGoal);
}
export async function createPersonalGoal(entry: PersonalSkill, options: {newGoal?:boolean} = {}) {
  const saved = readJourneyState().personalSkills?.find(item => item.id === entry.id);
  if (!saved || !same(saved,entry) || !saved.wantsLearning) throw Error("Choose a saved learning interest for this personal skill first.");
  if (!personalSkillIsCurrent(entry)) throw Error("Your work changed. Review the personal skill against a current task first.");
  return create(`personal:${entry.id}`, {skill:{source:"personal",id:entry.id,label:entry.name,sourceVersion:null},decision:entry.decision??null,tasks:entry.taskIds.map((id,index)=>({id,wording:entry.taskLabels[index]})),occupationCode:null,sourceOccupationUri:null,career:null,origin:"work",workKey:entry.workKey,wording:`Develop ${entry.name}`}, options.newGoal);
}
export async function createContextGoal(context: LearningContext, options: {newGoal?:boolean} = {}) {
  const saved=readLearningContext(context.id);
  if (!saved || !same(saved,context)) throw Error("This learning choice changed. Reload before continuing.");
  if (learningContextNeedsReview(context)) throw Error("Review this learning choice against your current work first.");
  return create(`context:${context.id}`,{skill:{source:"wef",id:String(context.skill.id),label:context.skill.name,sourceVersion:null},decision:context.origin==="work"?"accepted":null,tasks:context.taskIds.map((id,i)=>({id,wording:context.taskLabels[i]})),occupationCode:null,sourceOccupationUri:null,career:context.origin==="career"?context.career??null:null,origin:context.origin,workKey:context.workKey,wording:context.goal.trim()||`Develop ${context.skill.name}`},options.newGoal);
}
async function mutate(id:string, change:(goal:LearningGoal)=>void) {
  const goals=readLearningGoals(), goal=goals.find(g=>g.id===id);
  if (!goal) throw Error("This goal is no longer available.");
  const before=structuredClone(goal); change(goal);
  if (same(before,goal)) return;
  goal.history.push({revision:before.revision,recordedAt:new Date().toISOString(),wording:before.wording,action:before.action,attempts:before.attempts});
  goal.revision++; goal.needsReview=true; goal.updatedAt=new Date().toISOString();
  await persist(goals);
}
export const updateLearningGoal = (id:string, patch:{wording?:string;action?:GoalAction|null}) => mutate(id,g=>{
  if (patch.wording!==undefined) { if (!patch.wording.trim()) throw Error("Write a short goal."); g.wording=patch.wording.trim(); }
  if (patch.action!==undefined) { if (patch.action && !patch.action.text.trim()) throw Error("Write a short next action or keep this goal for later."); g.action=patch.action?{...patch.action,text:patch.action.text.trim()}:null; }
});
export const saveLearningAttempt = (goalId:string,input:AttemptInput) => mutate(goalId,g=>{
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  if (input.date > localToday) throw Error("Choose today or an earlier date for an attempt you have already made.");
  const previous=input.id?g.attempts.find(a=>a.id===input.id):undefined;
  if (input.id && !previous && g.history.some(h=>h.attempts.some(a=>a.id===input.id))) throw Error("This attempt was removed. Start a new attempt instead.");
  const task=input.type==="workplace_practice"?input.task??null:null;
  if (input.type==="workplace_practice" && !same(task,previous?.task)) {
    const profile=readJourneyProfile();
    if (!task || !profile.tasksConfirmed || !profile.tasks.some(t=>t.id===task.id && t.wording===task.wording)) throw Error("Choose a confirmed real work task for workplace practice.");
  }
  const now=new Date().toISOString();
  const a:LearningAttempt={id:input.id??crypto.randomUUID(),date:input.date,type:input.type,description:input.description.trim(),notes:input.notes?.trim()??"",task,createdAt:previous?.createdAt??now,updatedAt:previous?.updatedAt??now};
  if (!attemptValid(a)) throw Error("Enter a valid date, attempt type and short description. Workplace practice also needs its real task.");
  if (same(previous,a)) return;
  a.updatedAt=now;
  g.attempts=previous?g.attempts.map(item=>item.id===a.id?a:item):[...g.attempts,a];
});
export const removeLearningAttempt = (goalId:string,attemptId:string) => mutate(goalId,g=>{g.attempts=g.attempts.filter(a=>a.id!==attemptId);});
export function goalContextWarnings(goal:LearningGoal):string[] {
  const warnings:string[]=[];
  if (goal.initial.skill.source==="esco") {
    const e=readSpecialistState().entries.find(e=>`specialist:${specialistEntryKey(e)}`===goal.sourceKey), p=readJourneyProfile();
    if (!e || !e.wantsLearning || !p.tasksConfirmed || !specialistEntryIsCurrent(e,p.tasks,p.tasksOccupationCode) || e.sourceVersion!==goal.initial.skill.sourceVersion || e.skillLabel!==goal.initial.skill.label || e.taskWording!==goal.initial.tasks[0]?.wording || e.decision!==goal.initial.decision || e.occupationCode!==goal.initial.occupationCode || (e.sourceOccupationUri??null)!==goal.initial.sourceOccupationUri) warnings.push("Your work or skill choice has changed. This goal keeps its original starting record. Review the source before starting a new goal.");
  } else if (goal.initial.skill.source === "personal") {
    const entry = readJourneyState().personalSkills?.find(item => `personal:${item.id}` === goal.sourceKey);
    if (!entry || !entry.wantsLearning || !personalSkillIsCurrent(entry) || entry.name !== goal.initial.skill.label ||
        (entry.decision??null) !== goal.initial.decision || entry.workKey !== goal.initial.workKey ||
        !same(entry.taskIds,goal.initial.tasks.map(task=>task.id)) || !same(entry.taskLabels,goal.initial.tasks.map(task=>task.wording)))
      warnings.push("Your personal skill or work context has changed. This goal keeps your original words and starting record.");
  } else {
    const c=readLearningContext(goal.sourceKey.slice("context:".length));
    if (!c || learningContextNeedsReview(c) || String(c.skill.id)!==goal.initial.skill.id || c.skill.name!==goal.initial.skill.label || !same(c.origin==="career"?c.career??null:null,goal.initial.career) || c.workKey!==goal.initial.workKey || !same(c.taskIds,goal.initial.tasks.map(t=>t.id)) || !same(c.taskLabels,goal.initial.tasks.map(t=>t.wording))) warnings.push("Your learning context has changed. This goal keeps its original starting record.");
  }
  if (!goal.initial.tasks.length && !goal.initial.career) warnings.push("No confirmed work task or career reason was saved with this goal.");
  return warnings;
}
