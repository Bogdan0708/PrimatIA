import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, withTenantScopeMock, writeAuditLogMock, revalidatePathMock, prismaMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    withTenantScopeMock: vi.fn(),
    writeAuditLogMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    prismaMock: {
      proprietateCladire: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  }));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
  withTenantScope: withTenantScopeMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { updateBuilding } from "@/app/[locale]/(authenticated)/contribuabili/_actions/property-actions";

describe("shared property actions audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: {
        id: "user-1",
        tenantId: "tenant-1",
        role: "operator",
      },
    });
    withTenantScopeMock.mockImplementation(async (_tenantId: string, cb: () => Promise<unknown>) => cb());
  });

  it("writes an audit row when a building is updated", async () => {
    prismaMock.proprietateCladire.findFirst.mockResolvedValue({
      id: "building-1",
      contribuabilId: "contrib-1",
      destinatie: "rezidential",
      tipConstructie: "beton",
      anConstructie: 2000,
      suprafataConstruita: 120,
      suprafataUtila: 100,
      suprafataDesfasurata: 120,
      nrEtaje: 1,
      valoareImpozabila: 200000,
      valoareInventar: 180000,
      suprafataRezidentiala: 100,
      suprafataNerezidentiala: 20,
      zona: "A",
      cotaParte: 100,
      nrProprietari: 1,
      dataDobandire: new Date("2020-01-01"),
      dataInstrainare: null,
      numarCadastral: "cad-1",
      numarCarteFunciara: "cf-1",
      status: "active",
    });

    prismaMock.proprietateCladire.update.mockResolvedValue({
      id: "building-1",
      contribuabilId: "contrib-1",
      destinatie: "mixta",
      tipConstructie: "beton",
      anConstructie: 2000,
      suprafataConstruita: 130,
      suprafataUtila: 100,
      suprafataDesfasurata: 130,
      nrEtaje: 1,
      valoareImpozabila: 220000,
      valoareInventar: 180000,
      suprafataRezidentiala: 90,
      suprafataNerezidentiala: 40,
      zona: "A",
      cotaParte: 100,
      nrProprietari: 1,
      dataDobandire: new Date("2020-01-01"),
      dataInstrainare: null,
      numarCadastral: "cad-1",
      numarCarteFunciara: "cf-1",
      status: "active",
    });

    const result = await updateBuilding("building-1", {
      destinatie: "mixta",
      tipConstructie: "beton",
      anConstructie: 2000,
      suprafataConstruita: 130,
      suprafataUtila: 100,
      suprafataDesfasurata: 130,
      nrEtaje: 1,
      valoareImpozabila: 220000,
      valoareInventar: 180000,
      suprafataRezidentiala: 90,
      suprafataNerezidentiala: 40,
      zona: "A",
      cotaParte: 100,
      nrProprietari: 1,
      dataDobandire: "2020-01-01",
      status: "active",
      numarCadastral: "cad-1",
      numarCarteFunciara: "cf-1",
    });

    expect(result).toEqual({ success: true });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: "update",
        entityType: "proprietate_cladire",
        entityId: "building-1",
        oldValues: expect.objectContaining({
          destinatie: "rezidential",
          suprafataConstruita: 120,
        }),
        newValues: expect.objectContaining({
          destinatie: "mixta",
          suprafataConstruita: 130,
        }),
      })
    );
  });
});
