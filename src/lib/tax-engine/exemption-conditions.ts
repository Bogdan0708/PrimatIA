/**
 * Art. 456 Cod Fiscal — Exemption conditions evaluator
 *
 * Evaluates ScutireRegula.conditions JSON against taxpayer and property data
 * to determine eligibility for mandatory/discretionary exemptions.
 */

import type { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// Types
// ============================================================================

export const TAXPAYER_FLAG_KEYS = [
  "handicapGrav",
  "veteranRazboi",
  "vaduvaVeteran",
  "erouRevolutie",
  "organizatieNonpro",
  "pensionar",
] as const;

export type TaxpayerFlagKey = (typeof TAXPAYER_FLAG_KEYS)[number];

export interface TaxpayerConditions {
  scope: "taxpayer";
  requires: TaxpayerFlagKey[];
  tipContribuabil?: "PF" | "PJ";
  autoApprove: boolean;
}

export interface PropertyConditions {
  scope: "property";
  propertyType: "cladire" | "teren";
  requires: "isCultReligios" | "isMonumentIstoric";
  autoApprove: boolean;
}

export type EligibilityConditions = TaxpayerConditions | PropertyConditions;

export interface EligibilityCheckResult {
  eligible: boolean;
  ruleId: string;
  ruleNameRo: string;
  contribuabilId: string;
  proprietateType?: string;
  proprietateId?: string;
  autoApprove: boolean;
  matchedFlag?: string;
}

// ============================================================================
// Snapshots (minimal shapes needed for evaluation)
// ============================================================================

export interface ContribuabilSnapshot {
  id: string;
  tip: string;
  handicapGrav: boolean;
  handicapCertNr?: string | null;
  handicapCertExp?: Date | null;
  veteranRazboi: boolean;
  vaduvaVeteran: boolean;
  erouRevolutie: boolean;
  organizatieNonpro: boolean;
  pensionar: boolean;
}

export interface BuildingSnapshot {
  id: string;
  isCultReligios: boolean;
  isMonumentIstoric: boolean;
}

export interface LandSnapshot {
  id: string;
  isCultReligios: boolean;
}

export interface RuleSnapshot {
  id: string;
  nameRo: string;
  conditions: unknown;
  discountPercent: Decimal | number;
}

// ============================================================================
// Conditions parser
// ============================================================================

export function parseConditions(raw: unknown): EligibilityConditions | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (obj.scope === "taxpayer") {
    const requires = obj.requires;
    if (!Array.isArray(requires) || requires.length === 0) return null;
    const validFlags = requires.filter((f): f is TaxpayerFlagKey =>
      TAXPAYER_FLAG_KEYS.includes(f as TaxpayerFlagKey)
    );
    if (validFlags.length === 0) return null;

    return {
      scope: "taxpayer",
      requires: validFlags,
      tipContribuabil:
        obj.tipContribuabil === "PF" || obj.tipContribuabil === "PJ"
          ? obj.tipContribuabil
          : undefined,
      autoApprove: obj.autoApprove === true,
    };
  }

  if (obj.scope === "property") {
    const propertyType = obj.propertyType;
    const requires = obj.requires;
    if (
      (propertyType !== "cladire" && propertyType !== "teren") ||
      (requires !== "isCultReligios" && requires !== "isMonumentIstoric")
    ) {
      return null;
    }
    return {
      scope: "property",
      propertyType,
      requires,
      autoApprove: obj.autoApprove === true,
    };
  }

  return null;
}

// ============================================================================
// Evaluator
// ============================================================================

export function evaluateConditions(
  rule: RuleSnapshot,
  contribuabil: ContribuabilSnapshot,
  buildings: BuildingSnapshot[],
  land: LandSnapshot[]
): EligibilityCheckResult[] {
  const conditions = parseConditions(rule.conditions);
  if (!conditions) return [];

  const results: EligibilityCheckResult[] = [];
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (conditions.scope === "taxpayer") {
    // Check tipContribuabil guard
    if (conditions.tipContribuabil && contribuabil.tip !== conditions.tipContribuabil) {
      return [];
    }

    // Check if ANY required flag is true
    for (const flag of conditions.requires) {
      if (!contribuabil[flag]) {
        continue;
      }

      if (flag === "handicapGrav") {
        const hasCertificateNumber =
          typeof contribuabil.handicapCertNr === "string" &&
          contribuabil.handicapCertNr.trim().length > 0;
        const certificateExpiry = contribuabil.handicapCertExp;
        const hasValidCertificate =
          certificateExpiry instanceof Date &&
          !Number.isNaN(certificateExpiry.getTime()) &&
          new Date(
            certificateExpiry.getFullYear(),
            certificateExpiry.getMonth(),
            certificateExpiry.getDate()
          ) >= todayDate;

        if (!hasCertificateNumber || !hasValidCertificate) {
          continue;
        }
      }

      if (contribuabil[flag]) {
        results.push({
          eligible: true,
          ruleId: rule.id,
          ruleNameRo: rule.nameRo,
          contribuabilId: contribuabil.id,
          autoApprove: conditions.autoApprove,
          matchedFlag: flag,
        });
        break; // one match is enough for taxpayer-level
      }
    }
  }

  if (conditions.scope === "property") {
    if (conditions.propertyType === "cladire") {
      for (const b of buildings) {
        if (b[conditions.requires as keyof BuildingSnapshot] === true) {
          results.push({
            eligible: true,
            ruleId: rule.id,
            ruleNameRo: rule.nameRo,
            contribuabilId: contribuabil.id,
            proprietateType: "cladire",
            proprietateId: b.id,
            autoApprove: conditions.autoApprove,
            matchedFlag: conditions.requires,
          });
        }
      }
    }

    if (conditions.propertyType === "teren") {
      for (const l of land) {
        if (conditions.requires === "isCultReligios" && l.isCultReligios) {
          results.push({
            eligible: true,
            ruleId: rule.id,
            ruleNameRo: rule.nameRo,
            contribuabilId: contribuabil.id,
            proprietateType: "teren",
            proprietateId: l.id,
            autoApprove: conditions.autoApprove,
            matchedFlag: conditions.requires,
          });
        }
      }
    }
  }

  return results;
}
