import { describe, expect, it } from "vitest";
import {
  calculateTaxableMonths,
  roundToLei,
  splitInstallments,
  calculateBonificatie,
  applyInflationIndex,
  getBuildingAgeCoefficient,
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

    it("calculates bonificatie as 10% rounded (default ceiling)", () => {
      expect(calculateBonificatie(131)).toBe(13);
    });

    it("uses HCL-configured bonificatie percentage when provided", () => {
      expect(calculateBonificatie(100, 5)).toBe(5); // 5% of 100
      expect(calculateBonificatie(200, 7.5)).toBe(15); // 7.5% of 200
    });

    it("caps bonificatie at 10% ceiling even if HCL sets higher", () => {
      expect(calculateBonificatie(100, 15)).toBe(10); // Capped at 10%
    });

    it("handles 0% bonificatie from HCL", () => {
      expect(calculateBonificatie(100, 0)).toBe(0);
    });

    it("applies inflation coefficient only when configured", () => {
      expect(applyInflationIndex(100, 1.05)).toBe(105);
      expect(applyInflationIndex(100, undefined)).toBe(100);
      expect(applyInflationIndex(100, 0)).toBe(100);
    });
  });

  describe("getBuildingAgeCoefficient — Legea 239/2025 abrogation", () => {
    it("returns age coefficients for fiscal year 2025 and earlier", () => {
      expect(getBuildingAgeCoefficient(1920, 2025)).toBe(0.85); // >100yr
      expect(getBuildingAgeCoefficient(1970, 2025)).toBe(0.9);  // >50yr
      expect(getBuildingAgeCoefficient(1993, 2025)).toBe(0.95); // >30yr
      expect(getBuildingAgeCoefficient(2010, 2025)).toBe(1.0);  // <30yr
    });

    it("returns 1.0 for ALL buildings in fiscal year 2026+ (age coefficients abrogated)", () => {
      expect(getBuildingAgeCoefficient(1920, 2026)).toBe(1.0); // 106yr old, still 1.0
      expect(getBuildingAgeCoefficient(1970, 2026)).toBe(1.0); // 56yr old, still 1.0
      expect(getBuildingAgeCoefficient(1993, 2026)).toBe(1.0); // 33yr old, still 1.0
      expect(getBuildingAgeCoefficient(2010, 2026)).toBe(1.0);
    });

    it("returns 1.0 for future fiscal years (2027+)", () => {
      expect(getBuildingAgeCoefficient(1900, 2027)).toBe(1.0);
    });
  });
});
