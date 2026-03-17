import { describe, it, expect } from "vitest";
import { sanitizeOccupancyFields } from "@/lib/occupancy-sanitization";

describe("sanitizeOccupancyFields", () => {
  it("clears all occupancy fields for residential buildings", () => {
    const result = sanitizeOccupancyFields("rezidentiala", {
      ocupareNerezidentiala: "inchiriat",
      chiriasNume: "SC Hacker SRL",
      chiriasCui: "RO99999999",
      contractNr: "C-FAKE",
      contractData: "2024-01-01",
      contractExpirare: "2025-01-01",
    });

    expect(result.ocupareNerezidentiala).toBeNull();
    expect(result.chiriasNume).toBeNull();
    expect(result.chiriasCui).toBeNull();
    expect(result.contractNr).toBeNull();
    expect(result.contractData).toBeNull();
    expect(result.contractExpirare).toBeNull();
  });

  it("clears all occupancy fields for rezidential (typo variant)", () => {
    const result = sanitizeOccupancyFields("rezidential", {
      ocupareNerezidentiala: "inchiriat",
      chiriasNume: "SC Test SRL",
    });
    expect(result.ocupareNerezidentiala).toBeNull();
    expect(result.chiriasNume).toBeNull();
  });

  it("rejects unknown occupancy values for non-residential buildings", () => {
    const result = sanitizeOccupancyFields("mixta", {
      ocupareNerezidentiala: "altceva",
      chiriasNume: "Should be cleared",
      contractNr: "INVALID-1",
    });

    expect(result.ocupareNerezidentiala).toBeNull();
    expect(result.chiriasNume).toBeNull();
    expect(result.contractNr).toBeNull();
  });

  it("preserves occupancy type for mixed buildings", () => {
    const result = sanitizeOccupancyFields("mixta", {
      ocupareNerezidentiala: "proprietar",
    });
    expect(result.ocupareNerezidentiala).toBe("proprietar");
  });

  it("preserves occupancy type for non-residential buildings", () => {
    const result = sanitizeOccupancyFields("nerezidentiala", {
      ocupareNerezidentiala: "inchiriat",
      chiriasNume: "SC Office SRL",
    });
    expect(result.ocupareNerezidentiala).toBe("inchiriat");
    expect(result.chiriasNume).toBe("SC Office SRL");
  });

  it("clears tenant details when ocupare is proprietar", () => {
    const result = sanitizeOccupancyFields("mixta", {
      ocupareNerezidentiala: "proprietar",
      chiriasNume: "Should be cleared",
      chiriasCui: "RO11111111",
      contractNr: "C-999",
      contractData: "2024-01-01",
      contractExpirare: "2025-01-01",
    });

    expect(result.ocupareNerezidentiala).toBe("proprietar");
    expect(result.chiriasNume).toBeNull();
    expect(result.chiriasCui).toBeNull();
    expect(result.contractNr).toBeNull();
    expect(result.contractData).toBeNull();
    expect(result.contractExpirare).toBeNull();
  });

  it("preserves tenant details when ocupare is inchiriat", () => {
    const result = sanitizeOccupancyFields("mixta", {
      ocupareNerezidentiala: "inchiriat",
      chiriasNume: "SC Contabilitate SRL",
      chiriasCui: "RO12345678",
      contractNr: "C-2024-001",
      contractData: "2024-01-15",
      contractExpirare: "2027-01-14",
    });

    expect(result.ocupareNerezidentiala).toBe("inchiriat");
    expect(result.chiriasNume).toBe("SC Contabilitate SRL");
    expect(result.chiriasCui).toBe("RO12345678");
    expect(result.contractNr).toBe("C-2024-001");
    expect(result.contractData?.toISOString().split("T")[0]).toBe("2024-01-15");
    expect(result.contractExpirare?.toISOString().split("T")[0]).toBe("2027-01-14");
  });

  it("preserves tenant details when ocupare is comodat", () => {
    const result = sanitizeOccupancyFields("nerezidential", {
      ocupareNerezidentiala: "comodat",
      chiriasNume: "Asociația Culturală",
      chiriasCui: null,
      contractNr: "COM-001",
    });

    expect(result.ocupareNerezidentiala).toBe("comodat");
    expect(result.chiriasNume).toBe("Asociația Culturală");
    expect(result.contractNr).toBe("COM-001");
  });

  it("normalizes invalid contract dates to null", () => {
    const result = sanitizeOccupancyFields("nerezidential", {
      ocupareNerezidentiala: "inchiriat",
      chiriasNume: "SC Office SRL",
      contractData: "invalid-date",
      contractExpirare: "also-invalid",
    });

    expect(result.ocupareNerezidentiala).toBe("inchiriat");
    expect(result.contractData).toBeNull();
    expect(result.contractExpirare).toBeNull();
  });

  it("clears tenant details when ocupare is empty/null", () => {
    const result = sanitizeOccupancyFields("mixta", {
      ocupareNerezidentiala: null,
      chiriasNume: "Should be cleared",
    });

    expect(result.ocupareNerezidentiala).toBeNull();
    expect(result.chiriasNume).toBeNull();
  });
});
