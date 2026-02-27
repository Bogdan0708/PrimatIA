import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

function getAuditLogModel() {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "AuditLog");
  expect(model).toBeDefined();
  return model!;
}

function getField(name: string) {
  const model = getAuditLogModel();
  const field = model.fields.find((f) => f.name === name);
  expect(field).toBeDefined();
  return field!;
}

describe("AuditLog Prisma contract", () => {
  it("maps to audit_logs table and keeps append-only timestamp shape", () => {
    const model = getAuditLogModel();
    expect(model.dbName).toBe("audit_logs");

    const fieldNames = model.fields.map((f) => f.name);
    expect(fieldNames).toContain("createdAt");
    expect(fieldNames).not.toContain("updatedAt");
    expect(fieldNames).not.toContain("deletedAt");

    expect(getField("createdAt").hasDefaultValue).toBe(true);
  });

  it("enforces required core fields and allows optional context fields", () => {
    expect(getField("tenantId").isRequired).toBe(true);
    expect(getField("action").isRequired).toBe(true);
    expect(getField("entityType").isRequired).toBe(true);

    // Current schema allows nullable linkage/context for flexible ingestion paths.
    expect(getField("entityId").isRequired).toBe(false);
    expect(getField("userId").isRequired).toBe(false);
    expect(getField("oldValues").isRequired).toBe(false);
    expect(getField("newValues").isRequired).toBe(false);
    expect(getField("ipAddress").isRequired).toBe(false);
    expect(getField("userAgent").isRequired).toBe(false);
  });

  it("keeps tenant relation and mapped column names for traceability fields", () => {
    const tenantField = getField("tenant");
    expect(tenantField.kind).toBe("object");

    expect(getField("tenantId").dbName).toBe("tenant_id");
    expect(getField("userId").dbName).toBe("user_id");
    expect(getField("entityType").dbName).toBe("entity_type");
    expect(getField("entityId").dbName).toBe("entity_id");
    expect(getField("createdAt").dbName).toBe("created_at");
  });
});
