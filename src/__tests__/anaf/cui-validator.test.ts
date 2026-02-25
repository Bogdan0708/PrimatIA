import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateCnp, validateCui } from "@/lib/anaf/cui-validator";

// ---------------------------------------------------------------------------
// CNP Validation (pure sync — no mocking)
// ---------------------------------------------------------------------------

describe("validateCnp", () => {
  it("validates a male born in 1985 (digit 1) correctly", () => {
    // CNP: 1850515350011 — male, 1985-05-15, Timiș (35), check digit valid
    // We build a valid CNP with correct check digit:
    // S=1, YY=85, MM=05, DD=15, CC=35, NNN=001, C=?
    // Digits: 1 8 5 0 5 1 5 3 5 0 0 1 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 2+56+45+0+20+6+15+15+40+0+0+9 = 208
    // 208 % 11 = 10 → check digit = 1
    const result = validateCnp("1850515350011");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("M");
    expect(result.birthDate).toBe("1985-05-15");
    expect(result.countyCode).toBe("Timiș");
  });

  it("validates a female born in 1990 (digit 2) correctly", () => {
    // S=2, YY=90, MM=03, DD=22, CC=12 (Cluj), NNN=001, C=?
    // Digits: 2 9 0 0 3 2 2 1 2 0 0 1 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 4+63+0+0+12+12+6+5+16+0+0+9 = 127
    // 127 % 11 = 6 → check digit = 6
    const result = validateCnp("2900322120016");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("F");
    expect(result.birthDate).toBe("1990-03-22");
    expect(result.countyCode).toBe("Cluj");
  });

  it("handles 2000s birth (digit 5 = male)", () => {
    // S=5, YY=03, MM=07, DD=10, CC=40 (București), NNN=001, C=?
    // Digits: 5 0 3 0 7 1 0 4 0 0 0 1 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 10+0+27+0+28+6+0+20+0+0+0+9 = 100
    // 100 % 11 = 1 → check digit = 1
    const result = validateCnp("5030710400011");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("M");
    expect(result.birthDate).toBe("2003-07-10");
    expect(result.countyCode).toBe("București");
  });

  it("handles 2000s birth (digit 6 = female)", () => {
    // S=6, YY=01, MM=12, DD=25, CC=01 (Alba), NNN=002, C=?
    // Digits: 6 0 1 1 2 2 5 0 1 0 0 2 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 12+0+9+1+8+12+15+0+8+0+0+18 = 83
    // 83 % 11 = 6 → check digit = 6
    const result = validateCnp("6011225010026");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("F");
    expect(result.birthDate).toBe("2001-12-25");
    expect(result.countyCode).toBe("Alba");
  });

  it("handles 1800s birth (digit 3 = male)", () => {
    // S=3, YY=80, MM=01, DD=01, CC=40 (București), NNN=001, C=?
    // Digits: 3 8 0 0 1 0 1 4 0 0 0 1 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 6+56+0+0+4+0+3+20+0+0+0+9 = 98
    // 98 % 11 = 10 → check digit = 1
    const result = validateCnp("3800101400011");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("M");
    expect(result.birthDate).toBe("1880-01-01");
  });

  it("handles 1800s birth (digit 4 = female)", () => {
    // S=4, YY=99, MM=06, DD=15, CC=02 (Arad), NNN=003, C=?
    // Digits: 4 9 9 0 6 1 5 0 2 0 0 3 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 8+63+81+0+24+6+15+0+16+0+0+27 = 240
    // 240 % 11 = 9 → check digit = 9
    const result = validateCnp("4990615020039");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("F");
    expect(result.birthDate).toBe("1899-06-15");
    expect(result.countyCode).toBe("Arad");
  });

  it("handles resident foreigner male (digit 7) → century 1900", () => {
    // S=7, YY=75, MM=03, DD=20, CC=22 (Iași), NNN=001, C=?
    // Digits: 7 7 5 0 3 2 0 2 2 0 0 1 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 14+49+45+0+12+12+0+10+16+0+0+9 = 167
    // 167 % 11 = 2 → check digit = 2
    const result = validateCnp("7750320220012");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("M");
    expect(result.birthDate).toBe("1975-03-20");
    expect(result.countyCode).toBe("Iași");
  });

  it("handles resident foreigner female (digit 8) → century 1900", () => {
    // S=8, YY=88, MM=11, DD=05, CC=13 (Constanța), NNN=002, C=?
    // Digits: 8 8 8 1 1 0 5 1 3 0 0 2 ?
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 16+56+72+1+4+0+15+5+24+0+0+18 = 211
    // 211 % 11 = 2 → check digit = 2
    const result = validateCnp("8881105130022");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("F");
    expect(result.birthDate).toBe("1988-11-05");
    expect(result.countyCode).toBe("Constanța");
  });

  it("rejects CNP with invalid length (12 digits)", () => {
    const result = validateCnp("185051535001");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/13 cifre/);
  });

  it("rejects CNP with invalid length (14 digits)", () => {
    const result = validateCnp("18505153500112");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/13 cifre/);
  });

  it("rejects bad check digit", () => {
    // Valid CNP is 1850515350011, change last digit to 2
    const result = validateCnp("1850515350012");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cifra de control/);
  });

  it("rejects first digit 0", () => {
    // S=0, rest doesn't matter as long as length is 13
    // Digits: 0 8 5 0 5 1 5 3 5 0 0 1 ?
    // We need a valid check digit to reach the S check
    // Weights: 2 7 9 1 4 6 3 5 8 2 7 9
    // Sum: 0+56+45+0+20+6+15+15+40+0+0+9 = 206
    // 206 % 11 = 8 → check digit = 8
    const result = validateCnp("0850515350018");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/prima cifră/);
  });

  it("rejects first digit 9", () => {
    // S=9
    // Digits: 9 8 5 0 5 1 5 3 5 0 0 1 ?
    // Sum: 18+56+45+0+20+6+15+15+40+0+0+9 = 224
    // 224 % 11 = 4 → check digit = 4
    const result = validateCnp("9850515350014");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/prima cifră/);
  });

  it("rejects invalid month 13", () => {
    // S=1, YY=85, MM=13, DD=15, CC=35, NNN=001, C=?
    // Digits: 1 8 5 1 3 1 5 3 5 0 0 1 ?
    // Sum: 2+56+45+1+12+6+15+15+40+0+0+9 = 201
    // 201 % 11 = 3 → check digit = 3
    const result = validateCnp("1851315350013");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/dată de naștere/);
  });

  it("rejects invalid day 32", () => {
    // S=1, YY=85, MM=05, DD=32, CC=35, NNN=001, C=?
    // Digits: 1 8 5 0 5 3 2 3 5 0 0 1 ?
    // Sum: 2+56+45+0+20+18+6+15+40+0+0+9 = 211
    // 211 % 11 = 2 → check digit = 2
    const result = validateCnp("1850532350012");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/dată de naștere/);
  });

  it("strips non-digit characters before validation", () => {
    // Same as valid male 1985 CNP: 1850515350011
    const result = validateCnp("1-850-515-350-011");
    expect(result.valid).toBe(true);
    expect(result.gender).toBe("M");
    expect(result.birthDate).toBe("1985-05-15");
  });

  it("maps known county codes correctly", () => {
    // county 01 = Alba — use the 2001 female CNP from above (county 01)
    const alba = validateCnp("6011225010026");
    expect(alba.countyCode).toBe("Alba");

    // county 40 = București
    const buc = validateCnp("5030710400011");
    expect(buc.countyCode).toBe("București");

    // county 52 = Giurgiu
    // S=1, YY=90, MM=01, DD=01, CC=52, NNN=001, C=?
    // Digits: 1 9 0 0 1 0 1 5 2 0 0 1 ?
    // Sum: 2+63+0+0+4+0+3+25+16+0+0+9 = 122
    // 122 % 11 = 1 → check digit = 1
    const giu = validateCnp("1900101520011");
    expect(giu.countyCode).toBe("Giurgiu");
  });

  it("returns raw 2-digit code for unknown county", () => {
    // county 99 — not in the map
    // S=1, YY=90, MM=01, DD=01, CC=99, NNN=001, C=?
    // Digits: 1 9 0 0 1 0 1 9 9 0 0 1 ?
    // Sum: 2+63+0+0+4+0+3+45+72+0+0+9 = 198
    // 198 % 11 = 0 → check digit = 0
    const result = validateCnp("1900101990010");
    expect(result.valid).toBe(true);
    expect(result.countyCode).toBe("99");
  });
});

// ---------------------------------------------------------------------------
// CUI Validation (async — mock fetch)
// ---------------------------------------------------------------------------

describe("validateCui", () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  // Helper to create a successful ANAF response
  function anafFoundResponse(overrides?: Record<string, unknown>) {
    return {
      ok: true,
      json: async () => ({
        found: [
          {
            date_generale: {
              cui: 12345678,
              denumire: "SC TEST SRL",
              adresa: "Str. Exemplu nr. 1",
              judet: "București",
              localitate: "Sector 3",
              stare_inregistrare: "INREGISTRAT",
              data_inregistrare: "2020-01-15",
              scpTVA: true,
              statusInactivi: false,
              ...overrides,
            },
            inregistrare_scop_Tva: { scpTVA: true },
          },
        ],
      }),
    };
  }

  it("strips 'RO' prefix and non-digit characters", async () => {
    // CUI 18189442 — valid Romanian CUI (check digit correct)
    // We use a CUI that passes offline check digit validation
    // Weights: [7,5,3,2,1,7,5,3,2], body = [1,8,1,8,9,4,4], padded to 9: [0,0,1,8,1,8,9,4,4]
    // sum = 0+0+3+16+1+56+45+12+8 = 141, (141*10)%11 = 1410%11 = 2
    // So check digit must be 2 → 18189442
    mockFetch.mockResolvedValueOnce(anafFoundResponse());

    await validateCui("RO-18189442");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].cui).toBe(18189442);
  });

  it("rejects CUI too short (< 2 digits)", () => {
    return expect(validateCui("1")).resolves.toMatchObject({
      valid: false,
      error: expect.stringContaining("2-10 cifre"),
    });
  });

  it("rejects CUI too long (> 10 digits)", () => {
    return expect(validateCui("12345678901")).resolves.toMatchObject({
      valid: false,
      error: expect.stringContaining("2-10 cifre"),
    });
  });

  it("rejects bad check digit offline (fetch NOT called)", async () => {
    // CUI 18189443 — bad check digit (should be 2, not 3)
    const result = await validateCui("18189443");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cifra de control/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns company info when ANAF finds the CUI", async () => {
    mockFetch.mockResolvedValueOnce(anafFoundResponse());

    const result = await validateCui("18189442");
    expect(result.valid).toBe(true);
    expect(result.company).toMatchObject({
      cui: "18189442",
      name: "SC TEST SRL",
      address: "Str. Exemplu nr. 1",
      county: "București",
      city: "Sector 3",
      isActive: true,
      isVatPayer: true,
      vatCode: "RO18189442",
    });
  });

  it("returns valid=false when ANAF says CUI not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notfound: [{ cui: 18189442 }] }),
    });

    const result = await validateCui("18189442");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/negăsit/);
  });

  it("returns error when ANAF response has no date_generale", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ found: [{}] }),
    });

    const result = await validateCui("18189442");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/incomplet/);
  });

  it("returns error on HTTP 500", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await validateCui("18189442");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/HTTP 500/);
  });

  it("returns error on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await validateCui("18189442");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("returns error on timeout", async () => {
    mockFetch.mockRejectedValueOnce(new Error("The operation was aborted"));

    const result = await validateCui("18189442");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("The operation was aborted");
  });

  it("marks company inactive when statusInactivi is true", async () => {
    mockFetch.mockResolvedValueOnce(
      anafFoundResponse({ statusInactivi: true }),
    );

    const result = await validateCui("18189442");
    expect(result.valid).toBe(true);
    expect(result.company?.isActive).toBe(false);
  });

  it("marks company inactive when stare_inregistrare is RADIAT", async () => {
    mockFetch.mockResolvedValueOnce(
      anafFoundResponse({ stare_inregistrare: "RADIAT" }),
    );

    const result = await validateCui("18189442");
    expect(result.valid).toBe(true);
    expect(result.company?.isActive).toBe(false);
  });
});
