import { describe, it, expect } from "vitest";
import {
  portalLoginSchema,
  paymentInitiateSchema,
  bankTransferSchema,
  paymentReversalSchema,
} from "@/lib/validations/portal";

describe("portalLoginSchema", () => {
  it("accepts valid email and password", () => {
    const result = portalLoginSchema.safeParse({
      email: "cetatean@example.ro",
      password: "Citizen123!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = portalLoginSchema.safeParse({ password: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = portalLoginSchema.safeParse({
      email: "not-an-email",
      password: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = portalLoginSchema.safeParse({
      email: "a@b.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing body fields", () => {
    const result = portalLoginSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.email).toBeDefined();
      expect(fields.password).toBeDefined();
    }
  });
});

describe("paymentInitiateSchema", () => {
  const validPayload = {
    contribuabilId: "550e8400-e29b-41d4-a716-446655440000",
    items: [
      { impozitId: "550e8400-e29b-41d4-a716-446655440001", amount: 100 },
    ],
  };

  it("accepts valid payload", () => {
    const result = paymentInitiateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      // description defaults to ""
      expect(result.data.items[0].description).toBe("");
    }
  });

  it("accepts payload with description", () => {
    const result = paymentInitiateSchema.safeParse({
      ...validPayload,
      items: [{ ...validPayload.items[0], description: "Impozit cladiri" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID contribuabilId", () => {
    const result = paymentInitiateSchema.safeParse({
      ...validPayload,
      contribuabilId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = paymentInitiateSchema.safeParse({
      ...validPayload,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = paymentInitiateSchema.safeParse({
      ...validPayload,
      items: [{ impozitId: "550e8400-e29b-41d4-a716-446655440001", amount: -5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = paymentInitiateSchema.safeParse({
      ...validPayload,
      items: [{ impozitId: "550e8400-e29b-41d4-a716-446655440001", amount: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("bankTransferSchema", () => {
  it("accepts valid payload", () => {
    const result = bankTransferSchema.safeParse({
      contribuabilId: "550e8400-e29b-41d4-a716-446655440000",
      items: [
        { impozitId: "550e8400-e29b-41d4-a716-446655440001", amount: 50.5 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing contribuabilId", () => {
    const result = bankTransferSchema.safeParse({
      items: [{ impozitId: "550e8400-e29b-41d4-a716-446655440001", amount: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("paymentReversalSchema", () => {
  it("accepts valid plataId and reason", () => {
    const result = paymentReversalSchema.safeParse({
      plataId: "550e8400-e29b-41d4-a716-446655440000",
      reason: "Plată duplicată",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID plataId", () => {
    const result = paymentReversalSchema.safeParse({
      plataId: "abc",
      reason: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty reason", () => {
    const result = paymentReversalSchema.safeParse({
      plataId: "550e8400-e29b-41d4-a716-446655440000",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reason over 500 chars", () => {
    const result = paymentReversalSchema.safeParse({
      plataId: "550e8400-e29b-41d4-a716-446655440000",
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("returns field-level errors in flatten format", () => {
    const result = paymentReversalSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.plataId).toBeDefined();
      expect(fields.reason).toBeDefined();
    }
  });
});
