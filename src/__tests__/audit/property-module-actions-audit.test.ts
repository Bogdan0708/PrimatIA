import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  setTenantContextMock,
  writeAuditLogMock,
  revalidatePathMock,
  prismaMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  setTenantContextMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  prismaMock: {
    adresa: {
      create: vi.fn(),
    },
    proprietateCladire: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    proprietateTeren: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    proprietateVehicul: {
      create: vi.fn(),
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
  setTenantContext: setTenantContextMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createCladire,
  deleteCladire,
} from "@/app/[locale]/(authenticated)/proprietati/cladiri/_actions/cladire-actions";
import { createTeren } from "@/app/[locale]/(authenticated)/proprietati/terenuri/_actions/teren-actions";
import { createVehicul } from "@/app/[locale]/(authenticated)/proprietati/vehicule/_actions/vehicul-actions";

describe("property module audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: {
        id: "user-1",
        tenantId: "tenant-1",
      },
    });
  });

  it("writes an audit row when a building is created", async () => {
    prismaMock.adresa.create.mockResolvedValue({
      id: "address-1",
      strada: "Strada Mare",
      numar: "1",
      bloc: null,
      scara: null,
      etaj: null,
      apartament: null,
      localitate: "Cluj",
      judet: "Cluj",
      codPostal: "400000",
      zonaFiscala: "A",
    });
    prismaMock.proprietateCladire.create.mockResolvedValue({
      id: "building-1",
      contribuabilId: "contrib-1",
      adresaId: "address-1",
      zona: "A",
      numarCadastral: "cad-1",
      numarCarteFunciara: "cf-1",
      destinatie: "rezidential",
      tipConstructie: "beton",
      anConstructie: 2005,
      suprafataConstruita: 110,
      suprafataUtila: 95,
      suprafataDesfasurata: 110,
      nrEtaje: 1,
      valoareImpozabila: 150000,
      valoareInventar: 150000,
      suprafataRezidentiala: 95,
      suprafataNerezidentiala: 15,
      cotaParte: 100,
      nrProprietari: 1,
      tipActProprietate: "contract",
      nrActProprietate: "123",
      dataActProprietate: new Date("2024-01-01"),
      dataDobandire: new Date("2024-01-01"),
      dataInstrainare: null,
      status: "active",
      adresa: {
        strada: "Strada Mare",
        numar: "1",
        bloc: null,
        scara: null,
        etaj: null,
        apartament: null,
        localitate: "Cluj",
        judet: "Cluj",
        codPostal: "400000",
        zonaFiscala: "A",
      },
    });

    const formData = new FormData();
    formData.set("contribuabilId", "contrib-1");
    formData.set("destinatie", "rezidential");
    formData.set("tipConstructie", "beton");
    formData.set("anConstructie", "2005");
    formData.set("suprafataConstruita", "110");
    formData.set("dataDobandire", "2024-01-01");
    formData.set("localitate", "Cluj");
    formData.set("judet", "Cluj");
    formData.set("strada", "Strada Mare");

    const result = await createCladire(formData);

    expect(result).toEqual({ success: true, data: { id: "building-1" } });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "proprietate_cladire",
        entityId: "building-1",
        newValues: expect.objectContaining({
          contribuabilId: "contrib-1",
          destinatie: "rezidential",
        }),
      })
    );
  });

  it("writes an audit row when a building is deleted", async () => {
    prismaMock.proprietateCladire.findFirst.mockResolvedValue({
      id: "building-1",
      contribuabilId: "contrib-1",
      adresaId: "address-1",
      zona: "A",
      numarCadastral: "cad-1",
      numarCarteFunciara: "cf-1",
      destinatie: "rezidential",
      tipConstructie: "beton",
      anConstructie: 2005,
      suprafataConstruita: 110,
      suprafataUtila: 95,
      suprafataDesfasurata: 110,
      nrEtaje: 1,
      valoareImpozabila: 150000,
      valoareInventar: 150000,
      suprafataRezidentiala: 95,
      suprafataNerezidentiala: 15,
      cotaParte: 100,
      nrProprietari: 1,
      tipActProprietate: "contract",
      nrActProprietate: "123",
      dataActProprietate: new Date("2024-01-01"),
      dataDobandire: new Date("2024-01-01"),
      dataInstrainare: null,
      status: "active",
      adresa: {
        strada: "Strada Mare",
        numar: "1",
        bloc: null,
        scara: null,
        etaj: null,
        apartament: null,
        localitate: "Cluj",
        judet: "Cluj",
        codPostal: "400000",
        zonaFiscala: "A",
      },
    });
    prismaMock.proprietateCladire.update.mockResolvedValue({ id: "building-1" });

    const result = await deleteCladire("building-1");

    expect(result).toEqual({ success: true });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete",
        entityType: "proprietate_cladire",
        entityId: "building-1",
        oldValues: expect.objectContaining({
          contribuabilId: "contrib-1",
          destinatie: "rezidential",
        }),
      })
    );
  });

  it("writes an audit row when land is created", async () => {
    prismaMock.adresa.create.mockResolvedValue({
      id: "address-2",
      strada: "Campului",
      numar: "2",
      bloc: null,
      scara: null,
      etaj: null,
      apartament: null,
      localitate: "Sibiu",
      judet: "Sibiu",
      codPostal: "550000",
      zonaFiscala: "B",
    });
    prismaMock.proprietateTeren.create.mockResolvedValue({
      id: "land-1",
      contribuabilId: "contrib-2",
      adresaId: "address-2",
      zona: "B",
      numarCadastral: "cad-land",
      numarCarteFunciara: "cf-land",
      categorie: "intravilan",
      suprafataMp: 500,
      suprafataHa: 0.05,
      cotaParte: 100,
      tipActProprietate: "contract",
      nrActProprietate: "456",
      dataActProprietate: new Date("2023-01-01"),
      dataDobandire: new Date("2023-01-01"),
      dataInstrainare: null,
      status: "active",
      adresa: {
        strada: "Campului",
        numar: "2",
        bloc: null,
        scara: null,
        etaj: null,
        apartament: null,
        localitate: "Sibiu",
        judet: "Sibiu",
        codPostal: "550000",
        zonaFiscala: "B",
      },
    });

    const formData = new FormData();
    formData.set("contribuabilId", "contrib-2");
    formData.set("categorie", "intravilan");
    formData.set("suprafataMp", "500");
    formData.set("dataDobandire", "2023-01-01");
    formData.set("localitate", "Sibiu");
    formData.set("judet", "Sibiu");

    const result = await createTeren(formData);

    expect(result).toEqual({ success: true, data: { id: "land-1" } });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "proprietate_teren",
        entityId: "land-1",
      })
    );
  });

  it("writes an audit row when a vehicle is created", async () => {
    prismaMock.proprietateVehicul.create.mockResolvedValue({
      id: "vehicle-1",
      contribuabilId: "contrib-3",
      numarInmatriculare: "CJ01ABC",
      serieSasiu: "VIN123",
      nrCarteIdentitate: "CIV123",
      tipVehicul: "autoturism",
      marca: "Dacia",
      model: "Logan",
      anFabricatie: 2022,
      cilindreeCmc: 999,
      putereKw: 55,
      masaTotalaKg: 1200,
      nrLocuri: 5,
      normaPoluare: "Euro 6",
      tipCombustibil: "benzina",
      dataDobandire: new Date("2024-06-01"),
      dataInstrainare: null,
      status: "active",
    });

    const formData = new FormData();
    formData.set("contribuabilId", "contrib-3");
    formData.set("tipVehicul", "autoturism");
    formData.set("anFabricatie", "2022");
    formData.set("dataDobandire", "2024-06-01");

    const result = await createVehicul(formData);

    expect(result).toEqual({ success: true, data: { id: "vehicle-1" } });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "proprietate_vehicul",
        entityId: "vehicle-1",
        newValues: expect.objectContaining({
          tipVehicul: "autoturism",
          marca: "Dacia",
        }),
      })
    );
  });
});
