import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Seed tax_type_registry
  const taxTypes = [
    {
      code: "impozit_cladiri_rezidentiale",
      name: { ro: "Impozit pe clădiri rezidențiale", en: "Residential building tax", hu: "Lakóépület-adó" },
      legalBasis: "Art. 457",
      category: "cladiri",
      formulaType: "percent",
      sortOrder: 1,
    },
    {
      code: "impozit_cladiri_nerezidentiale",
      name: { ro: "Impozit pe clădiri nerezidențiale", en: "Non-residential building tax", hu: "Nem lakóépület-adó" },
      legalBasis: "Art. 458",
      category: "cladiri",
      formulaType: "percent",
      sortOrder: 2,
    },
    {
      code: "impozit_cladiri_mixte",
      name: { ro: "Impozit pe clădiri cu destinație mixtă", en: "Mixed-use building tax", hu: "Vegyes rendeltetésű épület-adó" },
      legalBasis: "Art. 459",
      category: "cladiri",
      formulaType: "percent",
      sortOrder: 3,
    },
    {
      code: "impozit_teren_intravilan",
      name: { ro: "Impozit pe teren intravilan", en: "Urban land tax", hu: "Belterületi telekadó" },
      legalBasis: "Art. 465",
      category: "teren",
      formulaType: "per_unit",
      sortOrder: 4,
    },
    {
      code: "impozit_teren_extravilan",
      name: { ro: "Impozit pe teren extravilan", en: "Agricultural land tax", hu: "Külterületi telekadó" },
      legalBasis: "Art. 465",
      category: "teren",
      formulaType: "per_unit",
      sortOrder: 5,
    },
    {
      code: "impozit_teren_curti",
      name: { ro: "Impozit pe teren curți construcții", en: "Yard/construction land tax", hu: "Udvari telekadó" },
      legalBasis: "Art. 465",
      category: "teren",
      formulaType: "per_unit",
      sortOrder: 6,
    },
    {
      code: "impozit_mijloace_transport",
      name: { ro: "Impozit pe mijloacele de transport", en: "Vehicle tax", hu: "Gépjárműadó" },
      legalBasis: "Art. 470",
      category: "vehicule",
      formulaType: "bracket",
      sortOrder: 7,
    },
    {
      code: "taxa_firma",
      name: { ro: "Taxa pentru afișaj în scop de reclamă și publicitate", en: "Advertising signage tax", hu: "Hirdetési adó" },
      legalBasis: "Art. 475",
      category: "alte_taxe",
      formulaType: "per_unit",
      isActive: false,
      sortOrder: 8,
    },
    {
      code: "taxa_hoteliera",
      name: { ro: "Taxa hotelieră", en: "Tourism/hotel tax", hu: "Idegenforgalmi adó" },
      legalBasis: "Art. 478",
      category: "alte_taxe",
      formulaType: "percent",
      isActive: false,
      sortOrder: 9,
    },
    {
      code: "taxa_spectacole",
      name: { ro: "Taxa pe spectacole", en: "Entertainment tax", hu: "Szórakozási adó" },
      legalBasis: "Art. 480",
      category: "alte_taxe",
      formulaType: "percent",
      isActive: false,
      sortOrder: 10,
    },
    {
      code: "taxa_utilizare_domeniu_public",
      name: { ro: "Taxa pentru utilizarea domeniului public", en: "Public domain usage tax", hu: "Közterület-használati díj" },
      legalBasis: "Art. 486",
      category: "alte_taxe",
      formulaType: "fixed",
      isActive: false,
      sortOrder: 11,
    },
    {
      code: "alte_taxe_locale",
      name: { ro: "Alte taxe locale", en: "Other local taxes", hu: "Egyéb helyi adók" },
      legalBasis: "Art. 486",
      category: "alte_taxe",
      formulaType: "fixed",
      isActive: false,
      sortOrder: 12,
    },
  ];

  for (const taxType of taxTypes) {
    await prisma.taxTypeRegistry.upsert({
      where: { code: taxType.code },
      update: {},
      create: taxType,
    });
  }
  console.log(`Seeded ${taxTypes.length} tax types`);

  // 2. Create platform tenant for super admin
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: "platform" },
    update: {},
    create: {
      name: "PrimărIA Platform",
      slug: "platform",
      county: "—",
      communeType: "municipiu",
      communeRank: 0,
      tier: "municipiu",
      status: "active",
    },
  });

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "admin@primaria.ro";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "changeme123!";

  await prisma.tenantUser.upsert({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: superAdminEmail,
      },
    },
    update: {},
    create: {
      tenantId: platformTenant.id,
      email: superAdminEmail,
      passwordHash: await hash(superAdminPassword, 12),
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
    },
  });
  console.log(`Super admin: ${superAdminEmail}`);

  // 3. Create demo tenant (Bogdan Vodă, Maramureș)
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: "bogdan-voda" },
    update: {},
    create: {
      name: "Primăria Comunei Bogdan Vodă",
      slug: "bogdan-voda",
      cui: "4895456",
      sirutaCode: "106158",
      county: "Maramureș",
      communeType: "comuna",
      communeRank: 5,
      population: 2800,
      zoneCount: 4,
      email: "primaria@bogdanvoda.ro",
      tier: "comuna",
      status: "active",
    },
  });

  const demoUsers = [
    { email: "admin@bogdanvoda.ro", firstName: "Ion", lastName: "Popescu", role: "primaria_admin" },
    { email: "operator@bogdanvoda.ro", firstName: "Maria", lastName: "Ionescu", role: "operator" },
    { email: "contabil@bogdanvoda.ro", firstName: "Ana", lastName: "Marin", role: "contabil" },
  ];

  for (const user of demoUsers) {
    await prisma.tenantUser.upsert({
      where: {
        tenantId_email: {
          tenantId: demoTenant.id,
          email: user.email,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        email: user.email,
        passwordHash: await hash("demo123!", 12),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  }
  console.log(`Demo tenant: ${demoTenant.name} with ${demoUsers.length} users`);

  // 4. Create fiscal zones for demo tenant
  const zones = [
    { zona: "A", denumire: "Zona A — centru localitate" },
    { zona: "B", denumire: "Zona B — zonă intermediară" },
    { zona: "C", denumire: "Zona C — periferie" },
    { zona: "D", denumire: "Zona D — zonă izolată" },
  ];

  for (const zone of zones) {
    await prisma.zonaFiscala.create({
      data: {
        tenantId: demoTenant.id,
        zona: zone.zona,
        denumire: zone.denumire,
      },
    });
  }
  console.log(`Seeded ${zones.length} fiscal zones for demo tenant`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
