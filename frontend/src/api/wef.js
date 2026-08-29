import { apiGet } from "./client";

export function listWefSkills() {
  return apiGet("/wef-skills");
}
