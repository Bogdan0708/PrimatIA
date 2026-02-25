import { describe, it, expect } from "vitest";
import {
  generateEpcQrPayload,
  generateRomanianTransferQr,
  getQrPayloadForTax,
} from "@/lib/payments/qr-generator";
import type { EpcQrData } from "@/lib/payments/qr-generator";

// --- Helpers ---

function makeEpcData(overrides?: Partial<EpcQrData>): EpcQrData {
  return {
    beneficiaryName: "Primăria Comunei Exemplu",
    iban: "RO49 AAAA 1B31 0075 9384 0000",
    amount: 150,
    ...overrides,
  };
}

// --- generateEpcQrPayload ---

describe("generateEpcQrPayload", () => {
  it("produces exactly 12 lines in EPC format", () => {
    const payload = generateEpcQrPayload(makeEpcData());
    const lines = payload.split("\n");
    expect(lines).toHaveLength(12);
  });

  it("sets correct EPC header lines: BCD, 002, 1, SCT", () => {
    const lines = generateEpcQrPayload(makeEpcData()).split("\n");
    expect(lines[0]).toBe("BCD");
    expect(lines[1]).toBe("002");
    expect(lines[2]).toBe("1");
    expect(lines[3]).toBe("SCT");
  });

  it("strips spaces from IBAN", () => {
    const lines = generateEpcQrPayload(
      makeEpcData({ iban: "RO49 AAAA 1B31 0075 9384 0000" }),
    ).split("\n");
    expect(lines[6]).toBe("RO49AAAA1B31007593840000");
  });

  it("truncates beneficiary name at 70 chars", () => {
    const longName = "A".repeat(100);
    const lines = generateEpcQrPayload(
      makeEpcData({ beneficiaryName: longName }),
    ).split("\n");
    expect(lines[5]).toHaveLength(70);
  });

  it("truncates reference at 35 chars", () => {
    const longRef = "R".repeat(50);
    const lines = generateEpcQrPayload(
      makeEpcData({ reference: longRef }),
    ).split("\n");
    expect(lines[9]).toHaveLength(35);
  });

  it("truncates description at 140 chars", () => {
    const longDesc = "D".repeat(200);
    const lines = generateEpcQrPayload(
      makeEpcData({ description: longDesc }),
    ).split("\n");
    expect(lines[10]).toHaveLength(140);
  });

  it("defaults currency to RON when omitted", () => {
    const lines = generateEpcQrPayload(makeEpcData()).split("\n");
    expect(lines[7]).toMatch(/^RON/);
  });

  it("uses provided currency", () => {
    const lines = generateEpcQrPayload(
      makeEpcData({ currency: "EUR" }),
    ).split("\n");
    expect(lines[7]).toBe("EUR150.00");
  });

  it("defaults BIC to empty string when omitted", () => {
    const lines = generateEpcQrPayload(makeEpcData()).split("\n");
    expect(lines[4]).toBe("");
  });

  it("includes BIC when provided", () => {
    const lines = generateEpcQrPayload(
      makeEpcData({ bic: "BTRLRO22" }),
    ).split("\n");
    expect(lines[4]).toBe("BTRLRO22");
  });

  it("formats amount with 2 decimal places", () => {
    const lines = generateEpcQrPayload(makeEpcData({ amount: 150 })).split(
      "\n",
    );
    expect(lines[7]).toBe("RON150.00");
  });

  it("formats fractional amounts correctly", () => {
    const lines = generateEpcQrPayload(makeEpcData({ amount: 99.5 })).split(
      "\n",
    );
    expect(lines[7]).toBe("RON99.50");
  });

  it("leaves reference empty when not provided", () => {
    const lines = generateEpcQrPayload(makeEpcData()).split("\n");
    expect(lines[9]).toBe("");
  });

  it("leaves description empty when not provided", () => {
    const lines = generateEpcQrPayload(makeEpcData()).split("\n");
    expect(lines[10]).toBe("");
  });

  it("leaves purpose (line 9) and beneficiary info (line 12) always empty", () => {
    const lines = generateEpcQrPayload(
      makeEpcData({ reference: "REF1", description: "test" }),
    ).split("\n");
    expect(lines[8]).toBe("");
    expect(lines[11]).toBe("");
  });
});

// --- generateRomanianTransferQr ---

describe("generateRomanianTransferQr", () => {
  it("always uses RON currency", () => {
    const payload = generateRomanianTransferQr({
      beneficiary: "Primăria Exemplu",
      iban: "RO49AAAA1B310075",
      amount: 200,
      reference: "REF-001",
    });
    const lines = payload.split("\n");
    expect(lines[7]).toBe("RON200.00");
  });

  it("uses default description when omitted", () => {
    const payload = generateRomanianTransferQr({
      beneficiary: "Primăria Exemplu",
      iban: "RO49AAAA1B310075",
      amount: 200,
      reference: "REF-001",
    });
    const lines = payload.split("\n");
    expect(lines[10]).toBe("Plata impozite - Ref REF-001");
  });

  it("passes custom description through", () => {
    const payload = generateRomanianTransferQr({
      beneficiary: "Primăria Exemplu",
      iban: "RO49AAAA1B310075",
      amount: 200,
      reference: "REF-001",
      description: "Plata taxa gunoi",
    });
    const lines = payload.split("\n");
    expect(lines[10]).toBe("Plata taxa gunoi");
  });
});

// --- getQrPayloadForTax ---

describe("getQrPayloadForTax", () => {
  it("formats description as 'Impozite {year} - {name} - Ref {ref}'", () => {
    const payload = getQrPayloadForTax({
      tenantName: "Primăria Sectorului 3",
      tenantIban: "RO49AAAA1B310075",
      amount: 500,
      contribuabilName: "Ion Popescu",
      fiscalYear: 2025,
      reference: "TAX-2025-001",
    });
    const lines = payload.split("\n");
    expect(lines[10]).toBe(
      "Impozite 2025 - Ion Popescu - Ref TAX-2025-001",
    );
  });

  it("passes tenant IBAN correctly (spaces stripped)", () => {
    const payload = getQrPayloadForTax({
      tenantName: "Primăria Sectorului 3",
      tenantIban: "RO49 AAAA 1B31 0075",
      amount: 500,
      contribuabilName: "Ion Popescu",
      fiscalYear: 2025,
      reference: "TAX-2025-001",
    });
    const lines = payload.split("\n");
    expect(lines[6]).toBe("RO49AAAA1B310075");
  });

  it("passes tenant name as beneficiary", () => {
    const payload = getQrPayloadForTax({
      tenantName: "Primăria Sectorului 3",
      tenantIban: "RO49AAAA1B310075",
      amount: 500,
      contribuabilName: "Ion Popescu",
      fiscalYear: 2025,
      reference: "TAX-2025-001",
    });
    const lines = payload.split("\n");
    expect(lines[5]).toBe("Primăria Sectorului 3");
  });

  it("passes amount correctly", () => {
    const payload = getQrPayloadForTax({
      tenantName: "Primăria Exemplu",
      tenantIban: "RO49AAAA1B310075",
      amount: 1234.56,
      contribuabilName: "Maria Ionescu",
      fiscalYear: 2024,
      reference: "REF-99",
    });
    const lines = payload.split("\n");
    expect(lines[7]).toBe("RON1234.56");
  });
});
