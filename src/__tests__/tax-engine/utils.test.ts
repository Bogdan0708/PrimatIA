import { describe, expect, it } from "vitest";
import {
  calculateTaxableMonths,
  roundToLei,
  splitInstallments,
  calculateBonificatie,
  applyInflationIndex,
} from "@/lib/tax-engine/utils";

describe("tax-engine utils", () => {
  describe("calculateTaxableMonths", () => {
    it("returns 0 months when acquisition is in future fiscal year", () => {
      const result = calculateTaxableMonths(2024, new Date(2025, 0, 1));
      expect(result.months).toBe(0);
    });

    it("returns 0 months when acquired in December of fiscal year", () => {
      const result = calculateTaxableMonths(2024, new Date(2024, 11, 15));
      expect(result.months).toBe(0);
      expect(result.startDate).toEqual(new Date(2025, 0, 1));
      expect(result.endDate).toEqual(new Date(2024, 11, 31));
    });

    it("includes disposal month (acquired before year, sold in September)", () => {
      const result = calculateTaxableMonths(
        2024,
        new Date(2020, 0, 1),
        new Date(2024, 8, 2)
      );
      expect(result.months).toBe(9);
      expect(result.endDate).toEqual(new Date(2024, 8, 30));
    });
  });

  describe("rounding and installments", () => {
    it("rounds bani using Math.round semantics", () => {
      expect(roundToLei(100.49)).toBe(100);
      expect(roundToLei(100.5)).toBe(101);
    });

    it("splits odd totals with remainder in first installment", () => {
      const result = splitInstallments(131, 2024);
      expect(result.rata1).toBe(66);
      expect(result.rata2).toBe(65);
    });

    it("calculates bonificatie as 10% rounded", () => {
      expect(calculateBonificatie(131)).toBe(13);
    });

    it("applies inflation coefficient only when configured", () => {
      expect(applyInflationIndex(100, 1.05)).toBe(105);
      expect(applyInflationIndex(100, undefined)).toBe(100);
      expect(applyInflationIndex(100, 0)).toBe(100);
    });
  });
});
