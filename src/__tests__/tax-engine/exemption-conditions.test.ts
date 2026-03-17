import { describe, it, expect } from "vitest";
import {
  evaluateConditions,
  parseConditions,
  type ContribuabilSnapshot,
  type BuildingSnapshot,
  type LandSnapshot,
  type RuleSnapshot,
} from "@/lib/tax-engine/exemption-conditions";
import { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// Helpers
// ============================================================================

function makeContribuabil(overrides: Partial<ContribuabilSnapshot> = {}): ContribuabilSnapshot {
  return {
    id: "c-1",
    tip: "PF",
    handicapGrav: false,
    handicapCertNr: null,
    handicapCertExp: null,
    veteranRazboi: false,
    vaduvaVeteran: false,
    erouRevolutie: false,
    organizatieNonpro: false,
    pensionar: false,
    ...overrides,
  };
}

function makeRule(conditions: unknown, overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    id: "r-1",
    nameRo: "Test Rule",
    conditions,
    discountPercent: new Decimal(100),
    ...overrides,
  };
}

// ============================================================================
// parseConditions
// ============================================================================

describe("parseConditions", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseConditions(null)).toBeNull();
    expect(parseConditions(undefined)).toBeNull();
    expect(parseConditions({})).toBeNull();
  });

  it("parses valid taxpayer conditions", () => {
    const result = parseConditions({
      scope: "taxpayer",
      requires: ["handicapGrav"],
      autoApprove: false,
    });
    expect(result).toEqual({
      scope: "taxpayer",
      requires: ["handicapGrav"],
      tipContribuabil: undefined,
      autoApprove: false,
    });
  });

  it("parses taxpayer conditions with tipContribuabil", () => {
    const result = parseConditions({
      scope: "taxpayer",
      requires: ["organizatieNonpro"],
      tipContribuabil: "PJ",
      autoApprove: false,
    });
    expect(result?.scope).toBe("taxpayer");
    if (result?.scope === "taxpayer") {
      expect(result.tipContribuabil).toBe("PJ");
    }
  });

  it("filters out invalid flag names", () => {
    const result = parseConditions({
      scope: "taxpayer",
      requires: ["invalidFlag", "handicapGrav"],
      autoApprove: true,
    });
    expect(result).not.toBeNull();
    if (result?.scope === "taxpayer") {
      expect(result.requires).toEqual(["handicapGrav"]);
    }
  });

  it("returns null for taxpayer with no valid flags", () => {
    expect(
      parseConditions({
        scope: "taxpayer",
        requires: ["badFlag"],
        autoApprove: false,
      })
    ).toBeNull();
  });

  it("parses valid property conditions", () => {
    const result = parseConditions({
      scope: "property",
      propertyType: "cladire",
      requires: "isCultReligios",
      autoApprove: true,
    });
    expect(result).toEqual({
      scope: "property",
      propertyType: "cladire",
      requires: "isCultReligios",
      autoApprove: true,
    });
  });

  it("returns null for property with invalid requires", () => {
    expect(
      parseConditions({
        scope: "property",
        propertyType: "cladire",
        requires: "invalidProp",
        autoApprove: false,
      })
    ).toBeNull();
  });
});

// ============================================================================
// evaluateConditions — Taxpayer scope
// ============================================================================

describe("evaluateConditions — taxpayer scope", () => {
  it("returns eligible when taxpayer has matching flag", () => {
    const rule = makeRule({
      scope: "taxpayer",
      requires: ["handicapGrav"],
      autoApprove: false,
    });
    const c = makeContribuabil({
      handicapGrav: true,
      handicapCertNr: "CERT-1",
      handicapCertExp: new Date("2099-12-31"),
    });
    const results = evaluateConditions(rule, c, [], []);

    expect(results).toHaveLength(1);
    expect(results[0].eligible).toBe(true);
    expect(results[0].matchedFlag).toBe("handicapGrav");
    expect(results[0].autoApprove).toBe(false);
  });

  it("returns empty when taxpayer has no matching flags", () => {
    const rule = makeRule({
      scope: "taxpayer",
      requires: ["veteranRazboi"],
      autoApprove: false,
    });
    const c = makeContribuabil({ veteranRazboi: false });
    const results = evaluateConditions(rule, c, [], []);

    expect(results).toHaveLength(0);
  });

  it("enforces tipContribuabil guard (PJ only)", () => {
    const rule = makeRule({
      scope: "taxpayer",
      requires: ["organizatieNonpro"],
      tipContribuabil: "PJ",
      autoApprove: false,
    });

    // PF taxpayer with flag set — should NOT match
    const pf = makeContribuabil({ tip: "PF", organizatieNonpro: true });
    expect(evaluateConditions(rule, pf, [], [])).toHaveLength(0);

    // PJ taxpayer with flag set — should match
    const pj = makeContribuabil({ tip: "PJ", organizatieNonpro: true });
    expect(evaluateConditions(rule, pj, [], [])).toHaveLength(1);
  });

  it("propagates autoApprove: true", () => {
    const rule = makeRule({
      scope: "taxpayer",
      requires: ["pensionar"],
      autoApprove: true,
    });
    const c = makeContribuabil({ pensionar: true });
    const results = evaluateConditions(rule, c, [], []);

    expect(results[0].autoApprove).toBe(true);
  });

  it("matches first flag only (one result per taxpayer-level rule)", () => {
    const rule = makeRule({
      scope: "taxpayer",
      requires: ["veteranRazboi", "erouRevolutie"],
      autoApprove: false,
    });
    const c = makeContribuabil({ veteranRazboi: true, erouRevolutie: true });
    const results = evaluateConditions(rule, c, [], []);

    expect(results).toHaveLength(1); // one match per taxpayer
  });

  it("rejects handicap eligibility when the certificate is missing or expired", () => {
    const rule = makeRule({
      scope: "taxpayer",
      requires: ["handicapGrav"],
      autoApprove: false,
    });

    const missingCertificate = makeContribuabil({ handicapGrav: true });
    expect(evaluateConditions(rule, missingCertificate, [], [])).toHaveLength(0);

    const expiredCertificate = makeContribuabil({
      handicapGrav: true,
      handicapCertNr: "CERT-OLD",
      handicapCertExp: new Date("2020-01-01"),
    });
    expect(evaluateConditions(rule, expiredCertificate, [], [])).toHaveLength(0);
  });
});

// ============================================================================
// evaluateConditions — Property scope
// ============================================================================

describe("evaluateConditions — property scope", () => {
  it("matches building with isCultReligios", () => {
    const rule = makeRule({
      scope: "property",
      propertyType: "cladire",
      requires: "isCultReligios",
      autoApprove: true,
    });
    const buildings: BuildingSnapshot[] = [
      { id: "b-1", isCultReligios: true, isMonumentIstoric: false },
      { id: "b-2", isCultReligios: false, isMonumentIstoric: false },
    ];
    const c = makeContribuabil();
    const results = evaluateConditions(rule, c, buildings, []);

    expect(results).toHaveLength(1);
    expect(results[0].proprietateId).toBe("b-1");
    expect(results[0].proprietateType).toBe("cladire");
    expect(results[0].autoApprove).toBe(true);
  });

  it("matches building with isMonumentIstoric", () => {
    const rule = makeRule({
      scope: "property",
      propertyType: "cladire",
      requires: "isMonumentIstoric",
      autoApprove: false,
    });
    const buildings: BuildingSnapshot[] = [
      { id: "b-1", isCultReligios: false, isMonumentIstoric: true },
    ];
    const results = evaluateConditions(rule, makeContribuabil(), buildings, []);

    expect(results).toHaveLength(1);
    expect(results[0].matchedFlag).toBe("isMonumentIstoric");
  });

  it("matches land with isCultReligios", () => {
    const rule = makeRule({
      scope: "property",
      propertyType: "teren",
      requires: "isCultReligios",
      autoApprove: true,
    });
    const land: LandSnapshot[] = [
      { id: "l-1", isCultReligios: true },
      { id: "l-2", isCultReligios: false },
    ];
    const results = evaluateConditions(rule, makeContribuabil(), [], land);

    expect(results).toHaveLength(1);
    expect(results[0].proprietateId).toBe("l-1");
    expect(results[0].proprietateType).toBe("teren");
  });

  it("returns one result per matching property", () => {
    const rule = makeRule({
      scope: "property",
      propertyType: "cladire",
      requires: "isCultReligios",
      autoApprove: true,
    });
    const buildings: BuildingSnapshot[] = [
      { id: "b-1", isCultReligios: true, isMonumentIstoric: false },
      { id: "b-2", isCultReligios: true, isMonumentIstoric: false },
      { id: "b-3", isCultReligios: false, isMonumentIstoric: false },
    ];
    const results = evaluateConditions(rule, makeContribuabil(), buildings, []);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.proprietateId)).toEqual(["b-1", "b-2"]);
  });

  it("does not match land for cladire-scoped rule", () => {
    const rule = makeRule({
      scope: "property",
      propertyType: "cladire",
      requires: "isCultReligios",
      autoApprove: true,
    });
    const land: LandSnapshot[] = [{ id: "l-1", isCultReligios: true }];
    const results = evaluateConditions(rule, makeContribuabil(), [], land);

    expect(results).toHaveLength(0);
  });
});

// ============================================================================
// evaluateConditions — Malformed conditions
// ============================================================================

describe("evaluateConditions — malformed conditions", () => {
  it("returns empty for null conditions", () => {
    const rule = makeRule(null);
    expect(evaluateConditions(rule, makeContribuabil(), [], [])).toEqual([]);
  });

  it("returns empty for empty object conditions", () => {
    const rule = makeRule({});
    expect(evaluateConditions(rule, makeContribuabil(), [], [])).toEqual([]);
  });

  it("returns empty for string conditions", () => {
    const rule = makeRule("invalid");
    expect(evaluateConditions(rule, makeContribuabil(), [], [])).toEqual([]);
  });
});
