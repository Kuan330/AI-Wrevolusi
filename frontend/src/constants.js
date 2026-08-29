export const STEPS = [
  { id: "home", path: "/", label: "Entry" },
  { id: "match", path: "/match", label: "Match" },
  { id: "tasks", path: "/tasks", label: "Tasks" },
  { id: "exposure", path: "/exposure", label: "Exposure" },
  { id: "skills", path: "/skills", label: "Skills" },
  { id: "overview", path: "/overview", label: "Overview" },
  { id: "next", path: "/next", label: "Next" },
];

export const INTERPRET = [
  { id: "continue_useful", label: "Continue to be useful" },
  { id: "need_strengthening", label: "Needs strengthening" },
  { id: "need_updating", label: "Needs updating as tasks change" },
];

export const EXPOSURE_STATES = [
  { id: "ai_assisted", label: "AI-assisted" },
  { id: "partly_automated", label: "Partly automated" },
  { id: "reshaped", label: "Reshaped" },
  { id: "human_led", label: "Human-led" },
  { id: "insufficient_data", label: "Insufficient data" },
];

export const CASCADE_LEVELS = [
  { id: "major", label: "Major group", placeholder: "Choose a major group" },
  { id: "sub_major", label: "Sub-major group", placeholder: "Choose a sub-major group" },
  { id: "minor", label: "Minor group", placeholder: "Choose a minor group" },
  { id: "unit", label: "Occupation", placeholder: "Choose an occupation" },
];

export function stateLabel(id) {
  return EXPOSURE_STATES.find((s) => s.id === id)?.label || id;
}

export function interpLabel(id) {
  return INTERPRET.find((s) => s.id === id)?.label || id;
}
