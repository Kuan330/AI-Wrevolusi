import { apiGet } from "./client";

export function listOccupations(parent) {
  if (parent) return apiGet(`/occupations?parent=${encodeURIComponent(parent)}`);
  return apiGet("/occupations");
}

export function getOccupation(code) {
  return apiGet(`/occupations/${encodeURIComponent(code)}`);
}

export function listOccupationTasks(code) {
  return apiGet(`/occupations/${encodeURIComponent(code)}/tasks`);
}

export function getOccupationExposure(code) {
  return apiGet(`/occupations/${encodeURIComponent(code)}/exposure`);
}
