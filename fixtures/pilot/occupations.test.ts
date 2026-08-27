import { describe, expect, it } from "vitest";

import { pilotOccupations } from "@/fixtures/pilot/occupations";

describe("pilotOccupations", () => {
  it("limits pilot to one validated occupation and up to two related occupations", () => {
    expect(pilotOccupations).toHaveLength(3);

    const validated = pilotOccupations.filter(
      (occupation) => occupation.status === "validated",
    );
    const nonValidated = pilotOccupations.filter(
      (occupation) => occupation.status !== "validated",
    );

    expect(validated).toHaveLength(1);
    expect(nonValidated.length).toBeLessThanOrEqual(2);
  });
});
