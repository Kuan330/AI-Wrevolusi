import test from "node:test";
import assert from "node:assert/strict";
const data=new Map(), handlers=new Map();
globalThis.window={localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},addEventListener:(name,handler)=>handlers.set(name,handler)};
const models=await import("../src/infrastructure/storage/modelPreferences.ts");
const {api}=await import("../src/services/api.ts");
test("model IDs trim, bound and deduplicate",()=>{
 assert.deepEqual(models.validateModelIds([" primary/model ","second-model"]),["primary/model","second-model"]);
 for(const invalid of [[],[""],["x","x"],Array(6).fill("x"),["x".repeat(161)],["foo\nbar"],["<script>"]])assert.throws(()=>models.validateModelIds(invalid));
});
test("local preference notifies same-tab subscribers, cross-tab changes, clear and restore",()=>{
 let events=0;const unsubscribe=models.subscribeModelPreferences(()=>events++);
 models.saveModelIds(["a","b"]);assert.deepEqual(models.readModelIds(),["a","b"]);assert.equal(events,1);
 data.set(models.MODEL_PREFERENCE_KEY,JSON.stringify(["c"]));handlers.get("storage")({key:models.MODEL_PREFERENCE_KEY});assert.deepEqual(models.readModelIds(),["c"]);assert.equal(events,2);
 models.restoreDefaultModels();assert.deepEqual(models.readModelIds(),[]);assert.equal(events,3);unsubscribe();
});
test("storage failure does not falsely apply settings",()=>{
 models.saveModelIds(["valid"]);const set=window.localStorage.setItem;window.localStorage.setItem=()=>{throw new Error("quota")};
 assert.throws(()=>models.saveModelIds(["new"]),/quota/);assert.deepEqual(models.readModelIds(),["valid"]);window.localStorage.setItem=set;models.restoreDefaultModels();
});
test("all AI request paths get override headers, non-AI requests do not",async()=>{
 models.saveModelIds(["first","second"]);const calls=[];
 globalThis.fetch=async(url,init)=>{calls.push([url,init.headers]);return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json"}})};
 for(const path of ["/resume/assist","/resume/generate","/resume/recommend-courses","/skill-directions/analyse","/skill-directions/learning-goal","/guided-learning/task-suggestions","/ai/task-match","/exposure/assessments","/learning/daily-brief","/reference/occupations?q=data"])await api.post(path,{});
 for(const [,headers]of calls)assert.equal(headers["X-AIW-Models"],'["first","second"]');
 await api.get("/account/workspace");assert.equal(calls.at(-1)[1]["X-AIW-Models"],undefined);
 models.restoreDefaultModels();await api.post("/resume/assist",{});assert.equal(calls.at(-1)[1]["X-AIW-Models"],undefined);
});
test("model change aborts pending requests and cannot return old output",async()=>{
 models.saveModelIds(["old"]);let abortObserved=false;
 globalThis.fetch=async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener("abort",()=>{abortObserved=true;reject(new DOMException("Aborted","AbortError"))}));
 const pending=api.post("/resume/assist",{});models.saveModelIds(["new"]);
 await assert.rejects(pending,error=>error.code==="ai_models_changed");assert.equal(abortObserved,true);models.restoreDefaultModels();
});
test("configuration changed while response parses is also rejected",async()=>{
 models.saveModelIds(["old"]);
 globalThis.fetch=async()=>({status:200,ok:true,headers:new Headers({"content-type":"application/json"}),json:async()=>{models.saveModelIds(["new"]);return {old:true}}});
 await assert.rejects(api.post("/ai/task-match",{}),error=>error.code==="ai_models_changed");models.restoreDefaultModels();
});

test("configuration revision stays changed after restoring an earlier model list",()=>{
 models.saveModelIds(["a"]);const before=models.modelPreferenceRevision();
 models.saveModelIds(["b"]);models.saveModelIds(["a"]);
 assert.ok(models.modelPreferenceRevision()>before);assert.deepEqual(models.readModelIds(),["a"]);models.restoreDefaultModels();
});
test("changing models and restoring them during response parsing still rejects the old request",async()=>{
 models.saveModelIds(["a"]);
 globalThis.fetch=async()=>({status:200,ok:true,headers:new Headers({"content-type":"application/json"}),json:async()=>{models.saveModelIds(["b"]);models.saveModelIds(["a"]);return {old:true}}});
 await assert.rejects(api.post("/ai/task-match",{}),error=>error.code==="ai_models_changed");models.restoreDefaultModels();
});
