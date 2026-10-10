import test from "node:test";
import assert from "node:assert/strict";
import { api, ApiError } from "../src/services/api.ts";
import { resumeService } from "../src/features/resume/service.ts";
test("assistant client budget exhaustion becomes ai_timeout without changing cancellation", async () => {
 const original=api.post;api.post=async()=>{throw new ApiError("Request timed out",408)};
 try {
  const controller=new AbortController();
  await assert.rejects(resumeService.assist("Refine",{cv:{sections:{}}},[],[],controller.signal),e=>e.status===504&&e.code==="ai_timeout"&&e.message==="AI editing timed out. Your resume is unchanged. Try again.");
  controller.abort();await assert.rejects(resumeService.assist("Refine",{cv:{sections:{}}},[],[],controller.signal),e=>e.status===408&&e.code!=="ai_timeout");
 } finally {api.post=original}
});
test("assistant preserves server timeout, transport and validation diagnostics without retry",async()=>{
 const original=api.post;let calls=0;
 try {
  for(const [status,code] of [[504,"ai_timeout"],[503,"ai_connection_failed"],[503,"ai_credentials_invalid"],[422,"unsupported_fact"]]){
   const error=new ApiError("Resume unchanged",status,{code});api.post=async()=>{calls++;throw error};
   await assert.rejects(resumeService.assist("Refine",{cv:{sections:{}}},[],[],new AbortController().signal),e=>e===error);
  }
  assert.equal(calls,4);
 }finally{api.post=original}
});
