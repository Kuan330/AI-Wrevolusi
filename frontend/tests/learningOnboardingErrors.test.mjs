import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError, apiErrorDetail } from '../src/services/api.ts';
import { onboardingSaveError } from '../src/features/learning-onboarding/learningOnboardingErrors.ts';

test('FastAPI validation messages survive parsing without leaking input or validation context',()=>{
 const detail=apiErrorDetail({detail:[{loc:['body','data'],msg:'Value error, Workspace contains unsupported records.',input:{password:'secret-password'},ctx:{error:'secret-context'}}]},422);
 assert.equal(detail,'Workspace contains unsupported records.');
 assert.doesNotMatch(detail,/secret|password/);
 assert.match(onboardingSaveError(new ApiError(detail,422)),/restart the backend/);
});
test('structured validation responses preserve meaningful messages through the real API wrapper',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({detail:[{msg:'Value error, Saved learning plans are invalid.',input:'private workspace'}]}),{status:422,headers:{'content-type':'application/json'}});
 try{await assert.rejects(api.patch('/account/workspace',{}),error=>error instanceof ApiError&&error.detail==='Saved learning plans are invalid.');}
 finally{globalThis.fetch=original;}
});
test('distinct causes get actionable messages and do not hide the underlying save problem',()=>{
 assert.match(onboardingSaveError(new ApiError('conflict',409)),/another tab/);
 assert.match(onboardingSaveError(new ApiError('expired',401)),/sign-in/);
 assert.match(onboardingSaveError(new ApiError('timeout',408)),/timed out/);
 assert.match(onboardingSaveError(new ApiError('invalid workspace',422)),/invalid workspace/);
 assert.match(onboardingSaveError(new ApiError('SQL password=secret',500)),/unavailable/);
 assert.doesNotMatch(onboardingSaveError(new ApiError('SQL password=secret',500)),/secret/);
 assert.match(onboardingSaveError(new TypeError('Failed to fetch')),/could not be reached/);
 assert.match(onboardingSaveError(new Error('Your account has reached its learning goal limit.')),/goal limit/);
});
test('malformed error bodies fall back safely and duplicated messages stay bounded',()=>{
 assert.equal(apiErrorDetail(null,422),'Request failed with status 422');
 assert.equal(apiErrorDetail({detail:[null,{},'x']},422),'Request failed with status 422');
 assert.equal(apiErrorDetail({detail:[{msg:'same'},{msg:'same'},{msg:'two'},{msg:'three'},{msg:'four'}]},422),'same two three');
 assert.equal(apiErrorDetail({detail:'ordinary error'},400),'ordinary error');
});
