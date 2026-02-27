import { describe, it, expect } from "vitest";
import { plataSchema } from "@/lib/validations";

/**
 * Payment recording validation tests.
 * Ensures the Zod schema enforces all business rules for payment creation.
 */

describe("plataSchema validation", () => {
  const validPayment = {
    contribuabilId: "550e8400-e29b-41d4-a716-446655440000",
    suma: 150.5,
    dataPlata: new Date("2026-02-27"),
    modalitate: "numerar" as const,
  };

  it("should accept a valid payment", () => {
    const result = plataSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("should reject negative amounts", () => {
    const result = plataSchema.safeParse({ ...validPayment, suma: -10 });
    expect(result.success).toBe(false);
  });

  it("should reject zero amount", () => {
    const result = plataSchema.safeParse({ ...validPayment, suma: 0 });
    expect(result.success).toBe(false);
  });

  it("should reject missing contribuabilId", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contribuabilId: _unused, ...withoutId } = validPayment;
    const result = plataSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("should reject invalid modalitate", () => {
    const result = plataSchema.safeParse({
      ...validPayment,
      modalitate: "bitcoin",
    });
    expect(result.success).toBe(false);
  });

  it("should accept all valid payment methods", () => {
    const methods = ["numerar", "virament", "mandat_postal", "ghiseul_ro", "card"] as const;
    for (const m of methods) {
      const result = plataSchema.safeParse({ ...validPayment, modalitate: m });
      expect(result.success).toBe(true);
    }
  });

  it("should reject non-UUID contribuabilId", () => {
    const result = plataSchema.safeParse({
      ...validPayment,
      contribuabilId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional nrChitanta", () => {
    const result = plataSchema.safeParse({
      ...validPayment,
      nrChitanta: "CHT-2026-000001",
    });
    expect(result.success).toBe(true);
  });

  it("should accept payment without optional fields", () => {
    const result = plataSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nrChitanta).toBeUndefined();
      expect(result.data.nrDocument).toBeUndefined();
      expect(result.data.nota).toBeUndefined();
    }
  });

  it("should coerce date strings to Date objects", () => {
    const result = plataSchema.safeParse({
      ...validPayment,
      dataPlata: "2026-02-27",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dataPlata).toBeInstanceOf(Date);
    }
  });
});
