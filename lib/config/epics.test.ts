import { describe, expect, it } from "vitest";

import { epicDefinitions } from "@/lib/config/epics";

describe("epicDefinitions", () => {
  it("contains all eight epics", () => {
    expect(epicDefinitions).toHaveLength(8);
    expect(epicDefinitions.map((epic) => epic.id)).toEqual([
      "E1",
      "E2",
      "E3",
      "E4",
      "E5",
      "E6",
      "E7",
      "E8",
    ]);
  });

  it("marks exactly E2, E3, E5 and E6 as AI/ML epics", () => {
    const aiEpics = epicDefinitions
      .filter((epic) => epic.usesAiMl)
      .map((epic) => epic.id);

    expect(aiEpics).toEqual(["E2", "E3", "E5", "E6"]);
  });
});
