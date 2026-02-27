import { describe, expect, it } from "vitest";
import {
  getOutstanding,
  getStatusAfterPayment,
  getTotalOwed,
} from "@/lib/tax-engine/liability-utils";

describe("liability utils", () => {
  it("computes total owed as principal + penalties", () => {
    expect(
      getTotalOwed({
        sumaDatorata: 100,
        sumaPenalitati: 15.5,
      })
    ).toBe(115.5);
  });

  it("computes outstanding as total owed - paid", () => {
    expect(
      getOutstanding({
        sumaDatorata: 100,
        sumaPenalitati: 20,
        sumaPlatita: 30,
      })
    ).toBe(90);
  });

  it("returns platit when payment reaches full debt including penalties", () => {
    const status = getStatusAfterPayment(
      { sumaDatorata: 100, sumaPenalitati: 10, sumaPlatita: 100 },
      10,
      "partial_platit"
    );
    expect(status).toBe("platit");
  });

  it("returns partial_platit for non-zero partial coverage", () => {
    const status = getStatusAfterPayment(
      { sumaDatorata: 200, sumaPenalitati: 0, sumaPlatita: 0 },
      50,
      "emis"
    );
    expect(status).toBe("partial_platit");
  });
});

