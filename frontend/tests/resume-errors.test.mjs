import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiErrorDetail } from "../src/services/api.ts";
import { resumeErrorMessage } from "../src/features/resume/errors.ts";
const document = { cv: { sections: { Skills: [], "Local project": [] } } };
test("legacy errors retain string detail and need no structured fields", () => {
  const error = new ApiError(apiErrorDetail({ detail: "Legacy message" }, 422), 422);
  assert.equal(resumeErrorMessage(error, document), "Legacy message");
  assert.equal(error.code, undefined);
  assert.deepEqual(error.fields, []);
});
test("render errors map numeric chapter and entry positions using only the local document", () => {
  const error = new ApiError("Check RenderCV values.", 422, { code: "render_values_invalid", fields: [["cv", "sections", 1, 0, "start_date"]] });
  assert.equal(error.code, "render_values_invalid");
  assert.match(resumeErrorMessage(error, document), /Sections → Local project → Entry 1 → Start Date/);
  assert.equal(resumeErrorMessage(error), "Some resume fields need attention. Check: Sections → Section 2 → Entry 1 → Start Date.");
});
test("generated sections are not confused with the existing draft", () => {
  const error = new ApiError("AI returned unsupported content.", 503, { code: "unverified_name", fields: [["sections", 0, "entries", 2, "text"]] });
  assert.match(resumeErrorMessage(error, document), /Sections → Generated section 1 → Entries → Entry 3 → Text/);
  assert.doesNotMatch(resumeErrorMessage(error, document), /Skills|Local project/);
});
test("malformed error metadata and unknown field labels cannot inject content", () => {
  const metadata = { code: "SECRET@EXAMPLE", fields: [["SECRET@example.test"], ["cv", "unknown_sensitive_value"], ["cv", -1], ["cv", 1.5], ["cv", {}]] };
  const error = new ApiError("Safe error.", 422, metadata);
  assert.equal(error.code, undefined);
  assert.deepEqual(error.fields, [["cv", "unknown_sensitive_value"]]);
  assert.equal(resumeErrorMessage(error, document), "Safe error. Check: Field.");
  metadata.fields[1][1] = "changed";
  assert.deepEqual(error.fields, [["cv", "unknown_sensitive_value"]]);
});
test("request paths and empty root paths have readable labels", () => {
  const error = new ApiError("Invalid request.", 422, { code: "invalid_request", fields: [["document", "cv", "phone"], []] });
  assert.equal(resumeErrorMessage(error), "Invalid request. Check: Phone; YAML document.");
  assert.equal(resumeErrorMessage(new Error("Read error")), "Read error");
});
