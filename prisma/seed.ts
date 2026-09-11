import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { seedTaxRates2025 } from "./seed/tax-rates-2025";
import { seedBudgetCodes } from "./seed/budget-codes";

const prisma = new PrismaClient();

// One password for every demo account in this seed run. Override with
// SEED_PASSWORD for a reproducible value (e.g. in CI); otherwise a random
// password is generated and printed once at the end of the seed — it is
// never committed and never hardcoded in docs or README.
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? randomBytes(9).toString("base64url");

async function main() {
  console.log("Seeding database...");

  // =============================================================================
  // 1. TAX TYPE REGISTRY (12 types — global, not tenant-scoped)
  // =============================================================================

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

  // Fetch tax type IDs for later use
  const taxTypeMap: Record<string, string> = {};
  const allTaxTypes = await prisma.taxTypeRegistry.findMany();
  for (const tt of allTaxTypes) {
    taxTypeMap[tt.code] = tt.id;
  }

  // =============================================================================
  // 2. PLATFORM TENANT + SUPER ADMIN
  // =============================================================================

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

  // =============================================================================
  // 3. DEMO TENANT (Bogdan Vodă, Maramureș)
  // =============================================================================

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

  const tenantId = demoTenant.id;

  // Per-user passwords for demo accounts (all share SEED_PASSWORD, printed below)
  const adminPasswordHash = await hash(SEED_PASSWORD, 12);
  const operatorPasswordHash = await hash(SEED_PASSWORD, 12);
  const contabilPasswordHash = await hash(SEED_PASSWORD, 12);

  // =============================================================================
  // 4. DEMO STAFF USERS (admin, operator, contabil)
  // =============================================================================

  const demoUsers = [
    { email: "admin@bogdanvoda.ro", firstName: "Ion", lastName: "Popescu", role: "primaria_admin", pwHash: adminPasswordHash },
    { email: "operator@bogdanvoda.ro", firstName: "Maria", lastName: "Ionescu", role: "operator", pwHash: operatorPasswordHash },
    { email: "contabil@bogdanvoda.ro", firstName: "Ana", lastName: "Marin", role: "contabil", pwHash: contabilPasswordHash },
  ];

  const staffUserIds: Record<string, string> = {};
  for (const user of demoUsers) {
    const u = await prisma.tenantUser.upsert({
      where: {
        tenantId_email: {
          tenantId,
          email: user.email,
        },
      },
      update: {},
      create: {
        tenantId,
        email: user.email,
        passwordHash: user.pwHash,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
    staffUserIds[user.role] = u.id;
  }
  console.log(`Demo tenant: ${demoTenant.name} with ${demoUsers.length} users`);

  // =============================================================================
  // 5. FISCAL ZONES (A, B, C, D)
  // =============================================================================

  const zones = [
    { zona: "A", denumire: "Zona A — centru localitate" },
    { zona: "B", denumire: "Zona B — zonă intermediară" },
    { zona: "C", denumire: "Zona C — periferie" },
    { zona: "D", denumire: "Zona D — zonă izolată" },
  ];

  // Delete existing zones for idempotency, then recreate
  await prisma.zonaFiscala.deleteMany({ where: { tenantId, hclDecisionId: null } });
  for (const zone of zones) {
    await prisma.zonaFiscala.create({
      data: {
        tenantId,
        zona: zone.zona,
        denumire: zone.denumire,
      },
    });
  }
  console.log(`Seeded ${zones.length} fiscal zones for demo tenant`);

  // =============================================================================
  // 6. ADDRESSES (for contribuabili and properties)
  // =============================================================================

  const streetNames = [
    "Str. Principală", "Str. Libertății", "Str. Unirii", "Str. Mihai Eminescu",
    "Str. Avram Iancu", "Str. 1 Decembrie", "Str. Republicii", "Str. Horea",
    "Str. Nicolae Bălcescu", "Str. Ștefan cel Mare", "Str. Alexandru Ioan Cuza",
    "Str. George Coșbuc", "Str. Victoriei", "Str. Gării", "Str. Livezilor",
    "Str. Florilor", "Str. Trandafirilor", "Str. Salcâmilor", "Str. Castanilor",
    "Str. Nucilor", "Str. Prunilor", "Str. Cireșilor", "Str. Merilor",
    "Str. Dealului", "Str. Vâlcele", "Str. Izvorului", "Str. Pădurii",
    "Str. Câmpului", "Str. Cetății", "Str. Bisericii",
  ];

  const addressZones: Array<"A" | "B" | "C" | "D"> = ["A", "A", "A", "B", "B", "B", "B", "C", "C", "D"];

  // Create addresses for each contribuabil + extra property addresses
  const addressData: Array<{
    strada: string;
    numar: string;
    localitate: string;
    judet: string;
    codPostal: string;
    zonaFiscala: string;
    bloc?: string;
    scara?: string;
    apartament?: string;
  }> = [];

  for (let i = 0; i < 80; i++) {
    const street = streetNames[i % streetNames.length];
    const zone = addressZones[i % addressZones.length];
    const entry: typeof addressData[0] = {
      strada: street,
      numar: `${(i % 120) + 1}`,
      localitate: "Bogdan Vodă",
      judet: "Maramureș",
      codPostal: "437060",
      zonaFiscala: zone,
    };
    // Some addresses are apartments
    if (i >= 50 && i < 60) {
      entry.bloc = `${Math.floor((i - 50) / 2) + 1}`;
      entry.scara = (i % 2 === 0) ? "A" : "B";
      entry.apartament = `${(i % 8) + 1}`;
    }
    addressData.push(entry);
  }

  // Delete existing addresses for idempotency then bulk create
  // NOTE: In production you'd never delete; here it's demo-only
  const existingAdrese = await prisma.adresa.findMany({ where: { tenantId } });
  if (existingAdrese.length === 0) {
    await prisma.adresa.createMany({
      data: addressData.map((a) => ({ tenantId, ...a })),
      skipDuplicates: true,
    });
  }

  const allAddresses = await prisma.adresa.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Seeded ${allAddresses.length} addresses`);

  // =============================================================================
  // 7. CONTRIBUABILI — 35 PF (persons) + 15 PJ (companies) = 50
  // =============================================================================

  const pfData = [
    { nume: "Popescu", prenume: "Ion", email: "ion.popescu@email.ro", telefon: "0740100001" },
    { nume: "Ionescu", prenume: "Maria", email: "maria.ionescu@email.ro", telefon: "0740100002" },
    { nume: "Popa", prenume: "Gheorghe", email: "gheorghe.popa@email.ro", telefon: "0740100003" },
    { nume: "Stoica", prenume: "Elena", email: "elena.stoica@email.ro", telefon: "0740100004" },
    { nume: "Stan", prenume: "Vasile", email: "vasile.stan@email.ro", telefon: "0740100005" },
    { nume: "Dumitrescu", prenume: "Ana", email: "ana.dumitrescu@email.ro", telefon: "0740100006" },
    { nume: "Gheorghe", prenume: "Mihai", email: "mihai.gheorghe@email.ro", telefon: "0740100007" },
    { nume: "Radu", prenume: "Ioana", email: "ioana.radu@email.ro", telefon: "0740100008" },
    { nume: "Munteanu", prenume: "Alexandru", email: "alexandru.munteanu@email.ro", telefon: "0740100009" },
    { nume: "Matei", prenume: "Daniela", email: "daniela.matei@email.ro", telefon: "0740100010" },
    { nume: "Constantin", prenume: "Adrian", email: "adrian.constantin@email.ro", telefon: "0740100011" },
    { nume: "Nistor", prenume: "Cornelia", email: "cornelia.nistor@email.ro", telefon: "0740100012" },
    { nume: "Moldovan", prenume: "Florin", email: "florin.moldovan@email.ro", telefon: "0740100013" },
    { nume: "Toma", prenume: "Luciana", email: "luciana.toma@email.ro", telefon: "0740100014" },
    { nume: "Dragomir", prenume: "Cristian", email: "cristian.dragomir@email.ro", telefon: "0740100015" },
    { nume: "Barbu", prenume: "Rodica", email: "rodica.barbu@email.ro", telefon: "0740100016" },
    { nume: "Luca", prenume: "Marian", email: "marian.luca@email.ro", telefon: "0740100017" },
    { nume: "Neagu", prenume: "Adriana", email: "adriana.neagu@email.ro", telefon: "0740100018" },
    { nume: "Ciobanu", prenume: "Dumitru", email: "dumitru.ciobanu@email.ro", telefon: "0740100019" },
    { nume: "Marinescu", prenume: "Silvia", email: "silvia.marinescu@email.ro", telefon: "0740100020" },
    { nume: "Florea", prenume: "Sorin", email: "sorin.florea@email.ro", telefon: "0740100021" },
    { nume: "Diaconu", prenume: "Gabriela", email: "gabriela.diaconu@email.ro", telefon: "0740100022" },
    { nume: "Voicu", prenume: "Andrei", email: "andrei.voicu@email.ro", telefon: "0740100023" },
    { nume: "Ene", prenume: "Valentina", email: "valentina.ene@email.ro", telefon: "0740100024" },
    { nume: "Preda", prenume: "Daniel", email: "daniel.preda@email.ro", telefon: "0740100025" },
    { nume: "Lungu", prenume: "Mariana", email: "mariana.lungu@email.ro", telefon: "0740100026" },
    { nume: "Sandu", prenume: "Petru", email: "petru.sandu@email.ro", telefon: "0740100027" },
    { nume: "Marin", prenume: "Doina", email: "doina.marin@email.ro", telefon: "0740100028" },
    { nume: "Tudor", prenume: "Vlad", email: "vlad.tudor@email.ro", telefon: "0740100029" },
    { nume: "Oprea", prenume: "Ramona", email: "ramona.oprea@email.ro", telefon: "0740100030" },
    { nume: "Grigorescu", prenume: "Stefan", email: "stefan.grigorescu@email.ro", telefon: "0740100031" },
    { nume: "Iacob", prenume: "Monica", email: "monica.iacob@email.ro", telefon: "0740100032" },
    { nume: "Ungureanu", prenume: "Pavel", email: "pavel.ungureanu@email.ro", telefon: "0740100033" },
    { nume: "Mihailescu", prenume: "Carmen", email: "carmen.mihailescu@email.ro", telefon: "0740100034" },
    { nume: "Bogdan", prenume: "Nicolae", email: "nicolae.bogdan@email.ro", telefon: "0740100035" },
  ];

  const pjData = [
    { nume: "SC Construct SRL", cui: "RO12345601", repr: "Popescu Vasile", email: "office@construct.ro", telefon: "0260100001", reg: "J24/101/2010" },
    { nume: "SC Agro Farm SRL", cui: "RO12345602", repr: "Ionescu Gheorghe", email: "office@agrofarm.ro", telefon: "0260100002", reg: "J24/102/2012" },
    { nume: "SC Maracons SA", cui: "RO12345603", repr: "Stan Mihai", email: "office@maracons.ro", telefon: "0260100003", reg: "J24/103/2005" },
    { nume: "SC Panificația Bogdan SRL", cui: "RO12345604", repr: "Munteanu Elena", email: "office@panificatia.ro", telefon: "0260100004", reg: "J24/104/2015" },
    { nume: "SC Transport Mara SRL", cui: "RO12345605", repr: "Radu Adrian", email: "office@transportmara.ro", telefon: "0260100005", reg: "J24/105/2018" },
    { nume: "SC Lemn Eco SRL", cui: "RO12345606", repr: "Popa Cristian", email: "office@lemneco.ro", telefon: "0260100006", reg: "J24/106/2008" },
    { nume: "SC Vila Turistica SRL", cui: "RO12345607", repr: "Barbu Ioana", email: "office@vilaturistica.ro", telefon: "0260100007", reg: "J24/107/2019" },
    { nume: "SC Ferma Bogdan SRL", cui: "RO12345608", repr: "Nistor Florin", email: "office@fermabogdan.ro", telefon: "0260100008", reg: "J24/108/2016" },
    { nume: "SC Mara Service Auto SRL", cui: "RO12345609", repr: "Dragomir Marian", email: "office@maraservice.ro", telefon: "0260100009", reg: "J24/109/2014" },
    { nume: "SC Aprozar Central SRL", cui: "RO12345610", repr: "Toma Daniela", email: "office@aprozar.ro", telefon: "0260100010", reg: "J24/110/2020" },
    { nume: "SC Moara Veche SRL", cui: "RO12345611", repr: "Matei Alexandru", email: "office@moaraveche.ro", telefon: "0260100011", reg: "J24/111/2011" },
    { nume: "SC Pensiunea Iza SRL", cui: "RO12345612", repr: "Moldovan Luciana", email: "office@pensiuneaiza.ro", telefon: "0260100012", reg: "J24/112/2017" },
    { nume: "SC Instalații Bogdan SRL", cui: "RO12345613", repr: "Ciobanu Sorin", email: "office@instalatiibogdan.ro", telefon: "0260100013", reg: "J24/113/2013" },
    { nume: "SC Alimentara Nord SRL", cui: "RO12345614", repr: "Florea Adriana", email: "office@alimentara.ro", telefon: "0260100014", reg: "J24/114/2021" },
    { nume: "SC Brutăria Sat SRL", cui: "RO12345615", repr: "Voicu Andrei", email: "office@brutaria.ro", telefon: "0260100015", reg: "J24/115/2022" },
  ];

  const contribuabilIds: string[] = [];

  // PF contribuabili
  for (let i = 0; i < pfData.length; i++) {
    const pf = pfData[i];
    const adresa = allAddresses[i % allAddresses.length];
    const codRol = `BV-PF-${String(i + 1).padStart(4, "0")}`;
    const existing = await prisma.contribuabil.findFirst({
      where: { tenantId, codRol },
    });
    if (existing) {
      // Ensure cnpHash is set for existing PF records
      if (!existing.cnpHash) {
        await prisma.contribuabil.update({
          where: { id: existing.id },
          data: { cnpHash: `SEED-PF-${String(i + 1).padStart(4, "0")}` },
        });
      }
      contribuabilIds.push(existing.id);
    } else {
      const c = await prisma.contribuabil.create({
        data: {
          tenantId,
          tip: "PF",
          cnp: null,
          cnpHash: `SEED-PF-${String(i + 1).padStart(4, "0")}`,
          cui: null,
          nume: pf.nume,
          prenume: pf.prenume,
          adresaDomiciliuId: adresa.id,
          telefon: pf.telefon,
          email: pf.email,
          codRol,
          nrDosarFiscal: `DF-${String(i + 1).padStart(4, "0")}`,
          dataInregistrare: new Date("2020-01-15"),
          status: "activ",
        },
      });
      contribuabilIds.push(c.id);
    }
  }

  // PJ contribuabili
  for (let i = 0; i < pjData.length; i++) {
    const pj = pjData[i];
    const adresa = allAddresses[(i + 35) % allAddresses.length];
    const codRol = `BV-PJ-${String(i + 1).padStart(4, "0")}`;
    const existing = await prisma.contribuabil.findFirst({
      where: { tenantId, codRol },
    });
    if (existing) {
      contribuabilIds.push(existing.id);
    } else {
      const c = await prisma.contribuabil.create({
        data: {
          tenantId,
          tip: "PJ",
          cnp: null,
          cnpHash: null,
          cui: pj.cui,
          nume: pj.nume,
          prenume: null,
          adresaDomiciliuId: adresa.id,
          telefon: pj.telefon,
          email: pj.email,
          reprezentantLegal: pj.repr,
          nrRegistruComert: pj.reg,
          codRol,
          nrDosarFiscal: `DF-PJ-${String(i + 1).padStart(4, "0")}`,
          dataInregistrare: new Date("2020-03-01"),
          status: "activ",
        },
      });
      contribuabilIds.push(c.id);
    }
  }
  console.log(`Seeded ${contribuabilIds.length} contribuabili (35 PF + 15 PJ)`);

  // =============================================================================
  // 8. PROPERTIES — BUILDINGS (~50)
  // =============================================================================

  const buildingConfigs: Array<{
    destinatie: string;
    tipConstructie: string;
    anConstructie: number;
    suprafataConstruita: number;
    suprafataUtila: number;
    nrEtaje: number;
    valoareImpozabila: number;
    zona: string;
    contribuabilIdx: number;
    addressIdx: number;
  }> = [
    // Residential — beton — zona A (10)
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 1985, suprafataConstruita: 120, suprafataUtila: 100, nrEtaje: 1, valoareImpozabila: 180000, zona: "A", contribuabilIdx: 0, addressIdx: 0 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 1990, suprafataConstruita: 150, suprafataUtila: 130, nrEtaje: 2, valoareImpozabila: 250000, zona: "A", contribuabilIdx: 1, addressIdx: 1 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2005, suprafataConstruita: 200, suprafataUtila: 175, nrEtaje: 2, valoareImpozabila: 350000, zona: "A", contribuabilIdx: 2, addressIdx: 2 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2010, suprafataConstruita: 180, suprafataUtila: 155, nrEtaje: 1, valoareImpozabila: 280000, zona: "A", contribuabilIdx: 3, addressIdx: 3 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2015, suprafataConstruita: 220, suprafataUtila: 195, nrEtaje: 2, valoareImpozabila: 400000, zona: "A", contribuabilIdx: 4, addressIdx: 4 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2018, suprafataConstruita: 160, suprafataUtila: 140, nrEtaje: 1, valoareImpozabila: 290000, zona: "A", contribuabilIdx: 5, addressIdx: 5 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2020, suprafataConstruita: 250, suprafataUtila: 220, nrEtaje: 2, valoareImpozabila: 480000, zona: "A", contribuabilIdx: 6, addressIdx: 6 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 1978, suprafataConstruita: 90, suprafataUtila: 78, nrEtaje: 1, valoareImpozabila: 120000, zona: "A", contribuabilIdx: 7, addressIdx: 7 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2000, suprafataConstruita: 140, suprafataUtila: 120, nrEtaje: 1, valoareImpozabila: 210000, zona: "A", contribuabilIdx: 8, addressIdx: 8 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2022, suprafataConstruita: 300, suprafataUtila: 265, nrEtaje: 3, valoareImpozabila: 600000, zona: "A", contribuabilIdx: 9, addressIdx: 9 },

    // Residential — beton — zona B (5)
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 1995, suprafataConstruita: 110, suprafataUtila: 95, nrEtaje: 1, valoareImpozabila: 160000, zona: "B", contribuabilIdx: 10, addressIdx: 10 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2002, suprafataConstruita: 170, suprafataUtila: 145, nrEtaje: 2, valoareImpozabila: 245000, zona: "B", contribuabilIdx: 11, addressIdx: 11 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2008, suprafataConstruita: 130, suprafataUtila: 112, nrEtaje: 1, valoareImpozabila: 195000, zona: "B", contribuabilIdx: 12, addressIdx: 12 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2014, suprafataConstruita: 190, suprafataUtila: 165, nrEtaje: 2, valoareImpozabila: 310000, zona: "B", contribuabilIdx: 13, addressIdx: 13 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2019, suprafataConstruita: 210, suprafataUtila: 185, nrEtaje: 2, valoareImpozabila: 370000, zona: "B", contribuabilIdx: 14, addressIdx: 14 },

    // Residential — caramida — zona A (5)
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1960, suprafataConstruita: 100, suprafataUtila: 85, nrEtaje: 1, valoareImpozabila: 110000, zona: "A", contribuabilIdx: 15, addressIdx: 15 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1972, suprafataConstruita: 130, suprafataUtila: 110, nrEtaje: 1, valoareImpozabila: 150000, zona: "A", contribuabilIdx: 16, addressIdx: 16 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1980, suprafataConstruita: 145, suprafataUtila: 125, nrEtaje: 1, valoareImpozabila: 175000, zona: "A", contribuabilIdx: 17, addressIdx: 17 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1988, suprafataConstruita: 160, suprafataUtila: 138, nrEtaje: 2, valoareImpozabila: 220000, zona: "A", contribuabilIdx: 18, addressIdx: 18 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 2001, suprafataConstruita: 185, suprafataUtila: 160, nrEtaje: 2, valoareImpozabila: 280000, zona: "A", contribuabilIdx: 19, addressIdx: 19 },

    // Residential — caramida — zona B (5)
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1955, suprafataConstruita: 85, suprafataUtila: 72, nrEtaje: 1, valoareImpozabila: 90000, zona: "B", contribuabilIdx: 20, addressIdx: 20 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1968, suprafataConstruita: 105, suprafataUtila: 90, nrEtaje: 1, valoareImpozabila: 115000, zona: "B", contribuabilIdx: 21, addressIdx: 21 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1975, suprafataConstruita: 120, suprafataUtila: 102, nrEtaje: 1, valoareImpozabila: 135000, zona: "B", contribuabilIdx: 22, addressIdx: 22 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1992, suprafataConstruita: 155, suprafataUtila: 132, nrEtaje: 2, valoareImpozabila: 200000, zona: "B", contribuabilIdx: 23, addressIdx: 23 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 2006, suprafataConstruita: 175, suprafataUtila: 150, nrEtaje: 2, valoareImpozabila: 260000, zona: "B", contribuabilIdx: 24, addressIdx: 24 },

    // Residential — lemn — zona A (3)
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1920, suprafataConstruita: 70, suprafataUtila: 58, nrEtaje: 1, valoareImpozabila: 45000, zona: "A", contribuabilIdx: 25, addressIdx: 25 },
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1940, suprafataConstruita: 85, suprafataUtila: 72, nrEtaje: 1, valoareImpozabila: 55000, zona: "A", contribuabilIdx: 26, addressIdx: 26 },
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1950, suprafataConstruita: 95, suprafataUtila: 80, nrEtaje: 1, valoareImpozabila: 62000, zona: "A", contribuabilIdx: 27, addressIdx: 27 },

    // Residential — lemn — zona C/D (4)
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1935, suprafataConstruita: 65, suprafataUtila: 55, nrEtaje: 1, valoareImpozabila: 35000, zona: "C", contribuabilIdx: 28, addressIdx: 28 },
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1945, suprafataConstruita: 80, suprafataUtila: 68, nrEtaje: 1, valoareImpozabila: 42000, zona: "C", contribuabilIdx: 29, addressIdx: 29 },
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1930, suprafataConstruita: 60, suprafataUtila: 50, nrEtaje: 1, valoareImpozabila: 30000, zona: "D", contribuabilIdx: 30, addressIdx: 30 },
    { destinatie: "rezidentiala", tipConstructie: "lemn", anConstructie: 1938, suprafataConstruita: 75, suprafataUtila: 62, nrEtaje: 1, valoareImpozabila: 38000, zona: "D", contribuabilIdx: 31, addressIdx: 31 },

    // Non-residential — PJ owned (10)
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2000, suprafataConstruita: 500, suprafataUtila: 450, nrEtaje: 1, valoareImpozabila: 850000, zona: "A", contribuabilIdx: 35, addressIdx: 35 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2005, suprafataConstruita: 1200, suprafataUtila: 1050, nrEtaje: 2, valoareImpozabila: 2200000, zona: "A", contribuabilIdx: 36, addressIdx: 36 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 1995, suprafataConstruita: 350, suprafataUtila: 300, nrEtaje: 1, valoareImpozabila: 520000, zona: "B", contribuabilIdx: 37, addressIdx: 37 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2010, suprafataConstruita: 200, suprafataUtila: 180, nrEtaje: 1, valoareImpozabila: 380000, zona: "A", contribuabilIdx: 38, addressIdx: 38 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2015, suprafataConstruita: 800, suprafataUtila: 720, nrEtaje: 2, valoareImpozabila: 1500000, zona: "A", contribuabilIdx: 39, addressIdx: 39 },
    { destinatie: "nerezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1990, suprafataConstruita: 280, suprafataUtila: 240, nrEtaje: 1, valoareImpozabila: 350000, zona: "B", contribuabilIdx: 40, addressIdx: 40 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2018, suprafataConstruita: 400, suprafataUtila: 360, nrEtaje: 1, valoareImpozabila: 720000, zona: "A", contribuabilIdx: 41, addressIdx: 41 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2020, suprafataConstruita: 600, suprafataUtila: 540, nrEtaje: 2, valoareImpozabila: 1100000, zona: "B", contribuabilIdx: 42, addressIdx: 42 },
    { destinatie: "nerezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1998, suprafataConstruita: 180, suprafataUtila: 155, nrEtaje: 1, valoareImpozabila: 250000, zona: "C", contribuabilIdx: 43, addressIdx: 43 },
    { destinatie: "nerezidentiala", tipConstructie: "cadre_beton", anConstructie: 2022, suprafataConstruita: 300, suprafataUtila: 270, nrEtaje: 1, valoareImpozabila: 550000, zona: "A", contribuabilIdx: 44, addressIdx: 44 },

    // Additional PF residential to reach ~50 (3 more)
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2012, suprafataConstruita: 175, suprafataUtila: 152, nrEtaje: 2, valoareImpozabila: 300000, zona: "B", contribuabilIdx: 32, addressIdx: 32 },
    { destinatie: "rezidentiala", tipConstructie: "pereti_caramida", anConstructie: 1998, suprafataConstruita: 140, suprafataUtila: 120, nrEtaje: 1, valoareImpozabila: 170000, zona: "C", contribuabilIdx: 33, addressIdx: 33 },
    { destinatie: "rezidentiala", tipConstructie: "cadre_beton", anConstructie: 2016, suprafataConstruita: 195, suprafataUtila: 170, nrEtaje: 2, valoareImpozabila: 340000, zona: "A", contribuabilIdx: 34, addressIdx: 34 },
  ];

  const buildingIds: string[] = [];
  const existingBuildings = await prisma.proprietateCladire.count({ where: { tenantId } });
  if (existingBuildings === 0) {
    for (let i = 0; i < buildingConfigs.length; i++) {
      const bc = buildingConfigs[i];
      const adresa = allAddresses[bc.addressIdx % allAddresses.length];
      const b = await prisma.proprietateCladire.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[bc.contribuabilIdx],
          adresaId: adresa.id,
          zona: bc.zona,
          numarCadastral: `NC-${String(i + 1).padStart(5, "0")}`,
          numarCarteFunciara: `CF-${String(i + 1).padStart(5, "0")}`,
          destinatie: bc.destinatie,
          tipConstructie: bc.tipConstructie,
          anConstructie: bc.anConstructie,
          suprafataConstruita: bc.suprafataConstruita,
          suprafataUtila: bc.suprafataUtila,
          suprafataDesfasurata: bc.suprafataConstruita * bc.nrEtaje,
          nrEtaje: bc.nrEtaje,
          valoareImpozabila: bc.valoareImpozabila,
          cotaParte: 100.0,
          nrProprietari: 1,
          tipActProprietate: "contract_vanzare",
          nrActProprietate: `CV-${String(i + 1).padStart(4, "0")}`,
          dataActProprietate: new Date(`${Math.max(bc.anConstructie, 2000)}-06-15`),
          dataDobandire: new Date(`${Math.max(bc.anConstructie, 2000)}-06-15`),
          status: "activ",
        },
      });
      buildingIds.push(b.id);
    }
  } else {
    const existingB = await prisma.proprietateCladire.findMany({
      where: { tenantId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    buildingIds.push(...existingB.map((b) => b.id));
  }
  console.log(`Seeded ${buildingIds.length} buildings`);

  // =============================================================================
  // 9. PROPERTIES — LAND PARCELS (~30)
  // =============================================================================

  const landConfigs: Array<{
    categorie: string;
    suprafataMp: number;
    suprafataHa: number | null;
    zona: string;
    contribuabilIdx: number;
    addressIdx: number;
  }> = [
    // intravilan_curti — zona A (5)
    { categorie: "intravilan_curti", suprafataMp: 500, suprafataHa: null, zona: "A", contribuabilIdx: 0, addressIdx: 0 },
    { categorie: "intravilan_curti", suprafataMp: 800, suprafataHa: null, zona: "A", contribuabilIdx: 1, addressIdx: 1 },
    { categorie: "intravilan_curti", suprafataMp: 350, suprafataHa: null, zona: "A", contribuabilIdx: 2, addressIdx: 2 },
    { categorie: "intravilan_curti", suprafataMp: 600, suprafataHa: null, zona: "A", contribuabilIdx: 5, addressIdx: 5 },
    { categorie: "intravilan_curti", suprafataMp: 450, suprafataHa: null, zona: "A", contribuabilIdx: 9, addressIdx: 9 },

    // intravilan_curti — zona B (5)
    { categorie: "intravilan_curti", suprafataMp: 700, suprafataHa: null, zona: "B", contribuabilIdx: 10, addressIdx: 10 },
    { categorie: "intravilan_curti", suprafataMp: 550, suprafataHa: null, zona: "B", contribuabilIdx: 11, addressIdx: 11 },
    { categorie: "intravilan_curti", suprafataMp: 900, suprafataHa: null, zona: "B", contribuabilIdx: 12, addressIdx: 12 },
    { categorie: "intravilan_curti", suprafataMp: 400, suprafataHa: null, zona: "B", contribuabilIdx: 14, addressIdx: 14 },
    { categorie: "intravilan_curti", suprafataMp: 650, suprafataHa: null, zona: "B", contribuabilIdx: 20, addressIdx: 20 },

    // intravilan_curti — zona C (3)
    { categorie: "intravilan_curti", suprafataMp: 1200, suprafataHa: null, zona: "C", contribuabilIdx: 28, addressIdx: 28 },
    { categorie: "intravilan_curti", suprafataMp: 1000, suprafataHa: null, zona: "C", contribuabilIdx: 29, addressIdx: 29 },
    { categorie: "intravilan_curti", suprafataMp: 850, suprafataHa: null, zona: "C", contribuabilIdx: 33, addressIdx: 33 },

    // intravilan_arabil (2)
    { categorie: "intravilan_arabil", suprafataMp: 2000, suprafataHa: null, zona: "B", contribuabilIdx: 3, addressIdx: 3 },
    { categorie: "intravilan_arabil", suprafataMp: 3000, suprafataHa: null, zona: "C", contribuabilIdx: 4, addressIdx: 4 },

    // extravilan_arabil (8)
    { categorie: "extravilan_arabil", suprafataMp: 50000, suprafataHa: 5.0, zona: "D", contribuabilIdx: 6, addressIdx: 45 },
    { categorie: "extravilan_arabil", suprafataMp: 30000, suprafataHa: 3.0, zona: "D", contribuabilIdx: 7, addressIdx: 46 },
    { categorie: "extravilan_arabil", suprafataMp: 80000, suprafataHa: 8.0, zona: "D", contribuabilIdx: 8, addressIdx: 47 },
    { categorie: "extravilan_arabil", suprafataMp: 120000, suprafataHa: 12.0, zona: "D", contribuabilIdx: 36, addressIdx: 48 },
    { categorie: "extravilan_arabil", suprafataMp: 200000, suprafataHa: 20.0, zona: "D", contribuabilIdx: 37, addressIdx: 49 },
    { categorie: "extravilan_arabil", suprafataMp: 45000, suprafataHa: 4.5, zona: "D", contribuabilIdx: 42, addressIdx: 50 },
    { categorie: "extravilan_arabil", suprafataMp: 70000, suprafataHa: 7.0, zona: "D", contribuabilIdx: 15, addressIdx: 51 },
    { categorie: "extravilan_arabil", suprafataMp: 25000, suprafataHa: 2.5, zona: "D", contribuabilIdx: 16, addressIdx: 52 },

    // extravilan_pasuni (7)
    { categorie: "extravilan_pasuni", suprafataMp: 100000, suprafataHa: 10.0, zona: "D", contribuabilIdx: 17, addressIdx: 53 },
    { categorie: "extravilan_pasuni", suprafataMp: 60000, suprafataHa: 6.0, zona: "D", contribuabilIdx: 18, addressIdx: 54 },
    { categorie: "extravilan_pasuni", suprafataMp: 150000, suprafataHa: 15.0, zona: "D", contribuabilIdx: 19, addressIdx: 55 },
    { categorie: "extravilan_pasuni", suprafataMp: 40000, suprafataHa: 4.0, zona: "D", contribuabilIdx: 38, addressIdx: 56 },
    { categorie: "extravilan_pasuni", suprafataMp: 80000, suprafataHa: 8.0, zona: "D", contribuabilIdx: 39, addressIdx: 57 },
    { categorie: "extravilan_pasuni", suprafataMp: 55000, suprafataHa: 5.5, zona: "D", contribuabilIdx: 25, addressIdx: 58 },
    { categorie: "extravilan_pasuni", suprafataMp: 90000, suprafataHa: 9.0, zona: "D", contribuabilIdx: 26, addressIdx: 59 },
  ];

  const landIds: string[] = [];
  const existingLand = await prisma.proprietateTeren.count({ where: { tenantId } });
  if (existingLand === 0) {
    for (let i = 0; i < landConfigs.length; i++) {
      const lc = landConfigs[i];
      const adresa = allAddresses[lc.addressIdx % allAddresses.length];
      const l = await prisma.proprietateTeren.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[lc.contribuabilIdx],
          adresaId: adresa.id,
          zona: lc.zona,
          numarCadastral: `NC-T-${String(i + 1).padStart(5, "0")}`,
          numarCarteFunciara: `CF-T-${String(i + 1).padStart(5, "0")}`,
          categorie: lc.categorie,
          suprafataMp: lc.suprafataMp,
          suprafataHa: lc.suprafataHa,
          cotaParte: 100.0,
          tipActProprietate: "titlu_proprietate",
          nrActProprietate: `TP-${String(i + 1).padStart(4, "0")}`,
          dataActProprietate: new Date("2015-03-20"),
          dataDobandire: new Date("2015-03-20"),
          status: "activ",
        },
      });
      landIds.push(l.id);
    }
  } else {
    const existingL = await prisma.proprietateTeren.findMany({
      where: { tenantId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    landIds.push(...existingL.map((l) => l.id));
  }
  console.log(`Seeded ${landIds.length} land parcels`);

  // =============================================================================
  // 10. PROPERTIES — VEHICLES (~20)
  // =============================================================================

  const vehicleConfigs: Array<{
    tipVehicul: string;
    marca: string;
    model: string;
    anFabricatie: number;
    cilindreeCmc: number | null;
    putereKw: number | null;
    masaTotalaKg: number | null;
    nrLocuri: number | null;
    normaPoluare: string;
    tipCombustibil: string;
    numarInmatriculare: string;
    contribuabilIdx: number;
  }> = [
    // Autoturisme sub 1600cc (3)
    { tipVehicul: "autoturism", marca: "Dacia", model: "Logan 1.2", anFabricatie: 2018, cilindreeCmc: 1199, putereKw: 55, masaTotalaKg: 1410, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "benzina", numarInmatriculare: "MM-01-BVD", contribuabilIdx: 0 },
    { tipVehicul: "autoturism", marca: "Dacia", model: "Sandero 1.0", anFabricatie: 2020, cilindreeCmc: 999, putereKw: 49, masaTotalaKg: 1320, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "benzina", numarInmatriculare: "MM-02-BVD", contribuabilIdx: 1 },
    { tipVehicul: "autoturism", marca: "Renault", model: "Clio 1.5 dCi", anFabricatie: 2016, cilindreeCmc: 1461, putereKw: 66, masaTotalaKg: 1400, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-03-BVD", contribuabilIdx: 2 },

    // Autoturisme 1601-2000cc (4)
    { tipVehicul: "autoturism", marca: "Volkswagen", model: "Golf 1.6 TDI", anFabricatie: 2017, cilindreeCmc: 1598, putereKw: 77, masaTotalaKg: 1540, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-04-BVD", contribuabilIdx: 3 },
    { tipVehicul: "autoturism", marca: "Skoda", model: "Octavia 1.8 TSI", anFabricatie: 2019, cilindreeCmc: 1798, putereKw: 132, masaTotalaKg: 1590, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "benzina", numarInmatriculare: "MM-05-BVD", contribuabilIdx: 5 },
    { tipVehicul: "autoturism", marca: "Ford", model: "Focus 2.0 TDCi", anFabricatie: 2015, cilindreeCmc: 1997, putereKw: 110, masaTotalaKg: 1600, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-06-BVD", contribuabilIdx: 6 },
    { tipVehicul: "autoturism", marca: "Dacia", model: "Duster 1.6", anFabricatie: 2021, cilindreeCmc: 1598, putereKw: 84, masaTotalaKg: 1650, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "benzina", numarInmatriculare: "MM-07-BVD", contribuabilIdx: 10 },

    // Autoturisme 2001-2600cc (3)
    { tipVehicul: "autoturism", marca: "BMW", model: "320d", anFabricatie: 2018, cilindreeCmc: 2000, putereKw: 140, masaTotalaKg: 1700, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-08-BVD", contribuabilIdx: 4 },
    { tipVehicul: "autoturism", marca: "Audi", model: "A4 2.0 TDI", anFabricatie: 2019, cilindreeCmc: 2000, putereKw: 150, masaTotalaKg: 1750, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-09-BVD", contribuabilIdx: 8 },
    { tipVehicul: "autoturism", marca: "Mercedes-Benz", model: "C220d", anFabricatie: 2020, cilindreeCmc: 2143, putereKw: 143, masaTotalaKg: 1770, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-10-BVD", contribuabilIdx: 9 },

    // Autoturisme 2601-3000cc (1)
    { tipVehicul: "autoturism", marca: "BMW", model: "530d xDrive", anFabricatie: 2019, cilindreeCmc: 2993, putereKw: 195, masaTotalaKg: 1950, nrLocuri: 5, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-11-BVD", contribuabilIdx: 34 },

    // Autoturisme peste 3000cc (1)
    { tipVehicul: "autoturism", marca: "Toyota", model: "Land Cruiser 4.5 V8", anFabricatie: 2017, cilindreeCmc: 4461, putereKw: 200, masaTotalaKg: 2740, nrLocuri: 7, normaPoluare: "euro_5", tipCombustibil: "motorina", numarInmatriculare: "MM-12-BVD", contribuabilIdx: 35 },

    // Camioane (3) — PJ
    { tipVehicul: "camion", marca: "MAN", model: "TGL 12.250", anFabricatie: 2016, cilindreeCmc: 6871, putereKw: 184, masaTotalaKg: 12000, nrLocuri: 3, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-13-BVD", contribuabilIdx: 39 },
    { tipVehicul: "camion", marca: "Iveco", model: "Eurocargo 7.5t", anFabricatie: 2018, cilindreeCmc: 3920, putereKw: 125, masaTotalaKg: 7500, nrLocuri: 3, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-14-BVD", contribuabilIdx: 35 },
    { tipVehicul: "camion", marca: "Mercedes-Benz", model: "Atego 1530", anFabricatie: 2020, cilindreeCmc: 7698, putereKw: 220, masaTotalaKg: 15000, nrLocuri: 3, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-15-BVD", contribuabilIdx: 40 },

    // Motociclete (2)
    { tipVehicul: "motocicleta", marca: "Honda", model: "CB500F", anFabricatie: 2021, cilindreeCmc: 471, putereKw: 35, masaTotalaKg: 189, nrLocuri: 2, normaPoluare: "euro_5", tipCombustibil: "benzina", numarInmatriculare: "MM-16-BVD", contribuabilIdx: 22 },
    { tipVehicul: "motocicleta", marca: "Yamaha", model: "MT-07", anFabricatie: 2022, cilindreeCmc: 689, putereKw: 54, masaTotalaKg: 184, nrLocuri: 2, normaPoluare: "euro_5", tipCombustibil: "benzina", numarInmatriculare: "MM-17-BVD", contribuabilIdx: 23 },

    // Autobuz (1) — PJ
    { tipVehicul: "autobuz", marca: "Mercedes-Benz", model: "Sprinter 519 CDI", anFabricatie: 2019, cilindreeCmc: 2987, putereKw: 140, masaTotalaKg: 5500, nrLocuri: 22, normaPoluare: "euro_6", tipCombustibil: "motorina", numarInmatriculare: "MM-18-BVD", contribuabilIdx: 39 },

    // Tractor (2) — PJ
    { tipVehicul: "tractor", marca: "John Deere", model: "5075E", anFabricatie: 2018, cilindreeCmc: 2900, putereKw: 55, masaTotalaKg: 3200, nrLocuri: 1, normaPoluare: "euro_3", tipCombustibil: "motorina", numarInmatriculare: "MM-19-BVD", contribuabilIdx: 36 },
    { tipVehicul: "tractor", marca: "New Holland", model: "T4.75", anFabricatie: 2020, cilindreeCmc: 2930, putereKw: 55, masaTotalaKg: 3050, nrLocuri: 1, normaPoluare: "euro_3", tipCombustibil: "motorina", numarInmatriculare: "MM-20-BVD", contribuabilIdx: 42 },
  ];

  const vehicleIds: string[] = [];
  const existingVehicles = await prisma.proprietateVehicul.count({ where: { tenantId } });
  if (existingVehicles === 0) {
    for (const vc of vehicleConfigs) {
      const v = await prisma.proprietateVehicul.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[vc.contribuabilIdx],
          numarInmatriculare: vc.numarInmatriculare,
          serieSasiu: `WBA${vc.numarInmatriculare.replace(/-/g, "")}${vc.anFabricatie}`,
          tipVehicul: vc.tipVehicul,
          marca: vc.marca,
          model: vc.model,
          anFabricatie: vc.anFabricatie,
          cilindreeCmc: vc.cilindreeCmc,
          putereKw: vc.putereKw,
          masaTotalaKg: vc.masaTotalaKg,
          nrLocuri: vc.nrLocuri,
          normaPoluare: vc.normaPoluare,
          tipCombustibil: vc.tipCombustibil,
          dataDobandire: new Date(`${vc.anFabricatie}-06-01`),
          status: "activ",
        },
      });
      vehicleIds.push(v.id);
    }
  } else {
    const existingV = await prisma.proprietateVehicul.findMany({
      where: { tenantId },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    vehicleIds.push(...existingV.map((v) => v.id));

    // Normalize normaPoluare values for existing vehicles (e.g. "Euro 6" → "euro_6")
    const normMap: Record<string, string> = {
      "Euro 1": "euro_1", "Euro 2": "euro_2", "Euro 3": "euro_3",
      "Euro 3A": "euro_3", "Euro 3B": "euro_3",
      "Euro 4": "euro_4", "Euro 5": "euro_5", "Euro 6": "euro_6",
      "Non-Euro": "non_euro", "Non Euro": "non_euro",
    };
    for (const [oldVal, newVal] of Object.entries(normMap)) {
      await prisma.proprietateVehicul.updateMany({
        where: { tenantId, normaPoluare: oldVal },
        data: { normaPoluare: newVal },
      });
    }
  }
  console.log(`Seeded ${vehicleIds.length} vehicles`);

  // =============================================================================
  // 11. HCL DECISION (2026) with RATE TABLES
  // =============================================================================

  let hclDecision = await prisma.hclDecision.findFirst({
    where: {
      tenantId,
      fiscalYear: 2026,
      status: { in: ["active", "activ"] },
    },
  });

  if (!hclDecision) {
    hclDecision = await prisma.hclDecision.create({
      data: {
        tenantId,
        hclNumber: "42/2025",
        hclDate: new Date("2025-12-15"),
        fiscalYear: 2026,
        title: "Hotărârea Consiliului Local nr. 42/2025 privind stabilirea impozitelor și taxelor locale pentru anul fiscal 2026",
        inflationIndex: 1.056,
        validFrom: new Date("2026-01-01"),
        validTo: new Date("2026-12-31"),
        status: "active",
        approvedBy: "Consiliul Local Bogdan Vodă",
      },
    });
  } else if (hclDecision.status === "activ") {
    hclDecision = await prisma.hclDecision.update({
      where: { id: hclDecision.id },
      data: { status: "active" },
    });
  }

  const hclId = hclDecision.id;

  // =============================================================================
  // 11b. Mandatory exemption rules (Art. 456)
  // =============================================================================

  const exemptionRuleDefs = [
    // Mandatory (obligatorie) rules — isSystemRule: true
    {
      nameRo: "Scutire obligatorie pentru persoane cu handicap grav sau accentuat",
      legalBasis: "Art. 456 alin. (1) lit. a) Cod fiscal",
      taxTypes: ["impozit_cladiri_rezidentiale", "impozit_teren_intravilan", "impozit_vehicul"],
      exemptionType: "obligatorie" as const,
      isSystemRule: true,
      conditions: { scope: "taxpayer", requires: ["handicapGrav"], autoApprove: false },
      requiredDocuments: ["certificat_handicap"],
    },
    {
      nameRo: "Scutire obligatorie pentru veterani de război",
      legalBasis: "Art. 456 alin. (1) lit. b) Cod fiscal",
      taxTypes: ["impozit_cladiri_rezidentiale", "impozit_teren_intravilan", "impozit_vehicul"],
      exemptionType: "obligatorie" as const,
      isSystemRule: true,
      conditions: { scope: "taxpayer", requires: ["veteranRazboi"], autoApprove: false },
      requiredDocuments: ["legitimatie_veteran"],
    },
    {
      nameRo: "Scutire obligatorie pentru văduve/văduvi de veterani",
      legalBasis: "Art. 456 alin. (1) lit. b) Cod fiscal",
      taxTypes: ["impozit_cladiri_rezidentiale", "impozit_teren_intravilan"],
      exemptionType: "obligatorie" as const,
      isSystemRule: true,
      conditions: { scope: "taxpayer", requires: ["vaduvaVeteran"], autoApprove: false },
      requiredDocuments: ["certificat_deces_veteran", "certificat_casatorie"],
    },
    {
      nameRo: "Scutire obligatorie pentru eroii Revoluției 1989",
      legalBasis: "Art. 456 alin. (1) lit. c) Cod fiscal",
      taxTypes: ["impozit_cladiri_rezidentiale", "impozit_teren_intravilan", "impozit_vehicul"],
      exemptionType: "obligatorie" as const,
      isSystemRule: true,
      conditions: { scope: "taxpayer", requires: ["erouRevolutie"], autoApprove: false },
      requiredDocuments: ["certificat_revolutionar"],
    },
    {
      nameRo: "Scutire obligatorie pentru clădiri ale cultelor religioase",
      legalBasis: "Art. 456 alin. (1) lit. d) Cod fiscal",
      taxTypes: ["impozit_cladiri_rezidentiale", "impozit_cladiri_nerezidentiale"],
      exemptionType: "obligatorie" as const,
      isSystemRule: true,
      conditions: { scope: "property", propertyType: "cladire", requires: "isCultReligios", autoApprove: true },
      requiredDocuments: [],
    },
    {
      nameRo: "Scutire obligatorie pentru terenuri ale cultelor religioase",
      legalBasis: "Art. 456 alin. (1) lit. d) Cod fiscal",
      taxTypes: ["impozit_teren_intravilan", "impozit_teren_extravilan"],
      exemptionType: "obligatorie" as const,
      isSystemRule: true,
      conditions: { scope: "property", propertyType: "teren", requires: "isCultReligios", autoApprove: true },
      requiredDocuments: [],
    },
    // Discretionary rules — isSystemRule: false
    {
      nameRo: "Scutire pentru clădiri monument istoric",
      legalBasis: "Art. 456 alin. (2) Cod fiscal + HCL",
      taxTypes: ["impozit_cladiri_rezidentiale", "impozit_cladiri_nerezidentiale"],
      exemptionType: "discretionara" as const,
      isSystemRule: false,
      conditions: { scope: "property", propertyType: "cladire", requires: "isMonumentIstoric", autoApprove: false },
      requiredDocuments: ["certificat_monument"],
      discountPercent: 50,
    },
    {
      nameRo: "Scutire pentru organizații nonprofit",
      legalBasis: "Art. 456 alin. (2) Cod fiscal + HCL",
      taxTypes: ["impozit_cladiri_nerezidentiale", "impozit_teren_intravilan"],
      exemptionType: "discretionara" as const,
      isSystemRule: false,
      conditions: { scope: "taxpayer", requires: ["organizatieNonpro"], tipContribuabil: "PJ", autoApprove: false },
      requiredDocuments: ["certificat_ong", "statut_organizatie"],
      discountPercent: 50,
    },
    {
      nameRo: "Scutire pentru pensionari",
      legalBasis: "Art. 456 alin. (2) Cod fiscal + HCL",
      taxTypes: ["impozit_cladiri_rezidentiale"],
      exemptionType: "discretionara" as const,
      isSystemRule: false,
      conditions: { scope: "taxpayer", requires: ["pensionar"], autoApprove: false },
      requiredDocuments: ["cupon_pensie"],
      discountPercent: 50,
    },
  ];

  for (const rule of exemptionRuleDefs) {
    const existingRule = await prisma.scutireRegula.findFirst({
      where: {
        tenantId,
        nameRo: rule.nameRo,
      },
    });

    if (!existingRule) {
      await prisma.scutireRegula.create({
        data: {
          tenantId,
          nameRo: rule.nameRo,
          legalBasis: rule.legalBasis,
          taxTypes: rule.taxTypes,
          discountPercent: ("discountPercent" in rule ? rule.discountPercent : 100) as number,
          exemptionType: rule.exemptionType,
          isSystemRule: rule.isSystemRule,
          conditions: rule.conditions,
          requiredDocuments: rule.requiredDocuments,
          autoRenewable: rule.isSystemRule,
          isActive: true,
          validFrom: new Date("2026-01-01"),
        },
      });
    } else {
      // Update conditions on existing rules
      await prisma.scutireRegula.update({
        where: { id: existingRule.id },
        data: {
          conditions: rule.conditions,
          requiredDocuments: rule.requiredDocuments,
          legalBasis: rule.legalBasis,
        },
      });
    }
  }

  // =============================================================================
  // 11c. ENRICH SEED DATA for tax calculation testing
  // =============================================================================

  // --- Art. 456 eligibility flags on select contribuabili ---

  // PF index 0 (Popescu Ion): handicap grav with valid certificate
  await prisma.contribuabil.update({
    where: { id: contribuabilIds[0] },
    data: {
      handicapGrav: true,
      handicapCertNr: "CERT-HG-2026-001",
      handicapCertExp: new Date("2028-12-31"),
    },
  });

  // PF index 1 (Ionescu Maria): veteran de razboi
  await prisma.contribuabil.update({
    where: { id: contribuabilIds[1] },
    data: { veteranRazboi: true },
  });

  // PF index 2 (Popa Gheorghe): erou revolutie
  await prisma.contribuabil.update({
    where: { id: contribuabilIds[2] },
    data: { erouRevolutie: true },
  });

  // PF index 3 (Stoica Elena): vaduva veteran
  await prisma.contribuabil.update({
    where: { id: contribuabilIds[3] },
    data: { vaduvaVeteran: true },
  });

  // PF index 4 (Stan Vasile): pensionar
  await prisma.contribuabil.update({
    where: { id: contribuabilIds[4] },
    data: { pensionar: true },
  });

  // PJ index 35+7=42 (SC Ferma Bogdan SRL at contribuabilIdx 42): nonprofit
  if (contribuabilIds[42]) {
    await prisma.contribuabil.update({
      where: { id: contribuabilIds[42] },
      data: { organizatieNonpro: true },
    });
  }

  console.log("Set Art. 456 eligibility flags on 6 contribuabili");

  // --- Property-level Art. 456 flags ---

  // First building (contribuabil 0, building 0): mark as cult religios
  if (buildingIds[0]) {
    await prisma.proprietateCladire.update({
      where: { id: buildingIds[0] },
      data: { isCultReligios: true },
    });
  }

  // Second building (contribuabil 1, building 1): mark as monument istoric
  if (buildingIds[1]) {
    await prisma.proprietateCladire.update({
      where: { id: buildingIds[1] },
      data: { isMonumentIstoric: true },
    });
  }

  // First land parcel (contribuabil 0, land 0): mark as cult religios
  if (landIds[0]) {
    await prisma.proprietateTeren.update({
      where: { id: landIds[0] },
      data: { isCultReligios: true },
    });
  }

  console.log("Set Art. 456 property flags on 2 buildings + 1 land parcel");

  // --- Mixed-use buildings (Art. 459) ---
  // Add 2 mixed-use buildings so the split-tax logic can be tested
  const mixedBuildingAddress = allAddresses[0];
  if (mixedBuildingAddress) {
    await prisma.proprietateCladire.upsert({
      where: { id: "00000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000001",
        tenantId,
        contribuabilId: contribuabilIds[35], // first PJ
        adresaId: mixedBuildingAddress.id,
        zona: "A",
        numarCadastral: "NC-MIX-00001",
        numarCarteFunciara: "CF-MIX-00001",
        destinatie: "mixta",
        tipConstructie: "cadre_beton",
        anConstructie: 2010,
        suprafataConstruita: 400,
        suprafataUtila: 360,
        suprafataDesfasurata: 400,
        nrEtaje: 1,
        valoareImpozabila: 700000,
        suprafataRezidentiala: 160,
        suprafataNerezidentiala: 240,
        ocupareNerezidentiala: "proprietar",
        cotaParte: 100.0,
        nrProprietari: 1,
        tipActProprietate: "contract_vanzare",
        nrActProprietate: "CV-MIX-0001",
        dataActProprietate: new Date("2010-06-15"),
        dataDobandire: new Date("2010-06-15"),
        status: "activ",
      },
    });

    await prisma.proprietateCladire.upsert({
      where: { id: "00000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000002",
        tenantId,
        contribuabilId: contribuabilIds[5], // PF Dumitrescu Ana
        adresaId: mixedBuildingAddress.id,
        zona: "B",
        numarCadastral: "NC-MIX-00002",
        numarCarteFunciara: "CF-MIX-00002",
        destinatie: "mixta",
        tipConstructie: "pereti_caramida",
        anConstructie: 1998,
        suprafataConstruita: 250,
        suprafataUtila: 220,
        suprafataDesfasurata: 250,
        nrEtaje: 1,
        valoareImpozabila: 350000,
        suprafataRezidentiala: 150,
        suprafataNerezidentiala: 100,
        ocupareNerezidentiala: "inchiriat",
        chiriasNume: "SC Contabilitate Expert SRL",
        chiriasCui: "RO99887766",
        contractNr: "C-2024-001",
        contractData: new Date("2024-01-15"),
        contractExpirare: new Date("2027-01-14"),
        cotaParte: 100.0,
        nrProprietari: 1,
        tipActProprietate: "contract_vanzare",
        nrActProprietate: "CV-MIX-0002",
        dataActProprietate: new Date("1998-09-20"),
        dataDobandire: new Date("1998-09-20"),
        status: "activ",
      },
    });
    console.log("Seeded 2 mixed-use buildings");
  }

  // --- Electric & hybrid vehicles (Legea 239/2025) ---
  await prisma.proprietateVehicul.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      tenantId,
      contribuabilId: contribuabilIds[7], // PF Radu Ioana
      numarInmatriculare: "MM-EV-001",
      serieSasiu: "WBAEV00120230001",
      tipVehicul: "autoturism",
      marca: "Tesla",
      model: "Model 3",
      anFabricatie: 2023,
      cilindreeCmc: null,
      putereKw: 208,
      masaTotalaKg: 1830,
      nrLocuri: 5,
      normaPoluare: "euro_6",
      tipCombustibil: "electric",
      dataDobandire: new Date("2023-06-01"),
      status: "activ",
    },
  });

  await prisma.proprietateVehicul.upsert({
    where: { id: "00000000-0000-0000-0000-000000000004" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000004",
      tenantId,
      contribuabilId: contribuabilIds[9], // PF Matei Daniela
      numarInmatriculare: "MM-HY-001",
      serieSasiu: "WBAHY00120220001",
      tipVehicul: "autoturism",
      marca: "Toyota",
      model: "RAV4 Hybrid",
      anFabricatie: 2022,
      cilindreeCmc: 2487,
      putereKw: 163,
      masaTotalaKg: 1800,
      nrLocuri: 5,
      normaPoluare: "euro_6",
      tipCombustibil: "hybrid",
      emisiiCo2GKm: 22,
      dataDobandire: new Date("2022-03-15"),
      status: "activ",
    },
  });

  await prisma.proprietateVehicul.upsert({
    where: { id: "00000000-0000-0000-0000-000000000005" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000005",
      tenantId,
      contribuabilId: contribuabilIds[11], // PF Nistor Cornelia
      numarInmatriculare: "MM-HY-002",
      serieSasiu: "WBAHY00220210001",
      tipVehicul: "autoturism",
      marca: "Volvo",
      model: "XC60 T8",
      anFabricatie: 2021,
      cilindreeCmc: 1969,
      putereKw: 288,
      masaTotalaKg: 2150,
      nrLocuri: 5,
      normaPoluare: "euro_6",
      tipCombustibil: "hybrid",
      emisiiCo2GKm: 55,
      dataDobandire: new Date("2021-09-10"),
      status: "activ",
    },
  });

  console.log("Seeded 1 electric + 2 hybrid vehicles");

  // Rate tables
  const rateTables: Array<{
    taxType: string;
    category: string | null;
    zona: string | null;
    rang: number | null;
    rateType: string;
    rateValue: number;
    unit: string | null;
    descriptionRo: string;
    legalArticle: string;
  }> = [
    { taxType: "impozit_cladiri_rezidentiale", category: "pereti_caramida", zona: "A", rang: null, rateType: "percent", rateValue: 0.0008, unit: null, descriptionRo: "Clădiri rezidențiale, pereți cărămidă, zona A — 0.08%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "pereti_caramida", zona: "B", rang: null, rateType: "percent", rateValue: 0.0006, unit: null, descriptionRo: "Clădiri rezidențiale, pereți cărămidă, zona B — 0.06%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "pereti_caramida", zona: "C", rang: null, rateType: "percent", rateValue: 0.0004, unit: null, descriptionRo: "Clădiri rezidențiale, pereți cărămidă, zona C — 0.04%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "pereti_caramida", zona: "D", rang: null, rateType: "percent", rateValue: 0.0002, unit: null, descriptionRo: "Clădiri rezidențiale, pereți cărămidă, zona D — 0.02%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "cadre_beton", zona: "A", rang: null, rateType: "percent", rateValue: 0.0008, unit: null, descriptionRo: "Clădiri rezidențiale, cadre beton, zona A — 0.08%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "cadre_beton", zona: "B", rang: null, rateType: "percent", rateValue: 0.0006, unit: null, descriptionRo: "Clădiri rezidențiale, cadre beton, zona B — 0.06%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "cadre_beton", zona: "C", rang: null, rateType: "percent", rateValue: 0.0004, unit: null, descriptionRo: "Clădiri rezidențiale, cadre beton, zona C — 0.04%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "cadre_beton", zona: "D", rang: null, rateType: "percent", rateValue: 0.0002, unit: null, descriptionRo: "Clădiri rezidențiale, cadre beton, zona D — 0.02%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "lemn", zona: "A", rang: null, rateType: "percent", rateValue: 0.0006, unit: null, descriptionRo: "Clădiri rezidențiale, lemn, zona A — 0.06%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "lemn", zona: "B", rang: null, rateType: "percent", rateValue: 0.0006, unit: null, descriptionRo: "Clădiri rezidențiale, lemn, zona B — 0.06%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "lemn", zona: "C", rang: null, rateType: "percent", rateValue: 0.0004, unit: null, descriptionRo: "Clădiri rezidențiale, lemn, zona C — 0.04%", legalArticle: "Art. 457" },
    { taxType: "impozit_cladiri_rezidentiale", category: "lemn", zona: "D", rang: null, rateType: "percent", rateValue: 0.0004, unit: null, descriptionRo: "Clădiri rezidențiale, lemn, zona D — 0.04%", legalArticle: "Art. 457" },

    // Building rates — non-residential (all zones)
    { taxType: "impozit_cladiri_nerezidentiale", category: null, zona: "A", rang: null, rateType: "percent", rateValue: 0.01, unit: null, descriptionRo: "Clădiri nerezidențiale, zona A — 1.0%", legalArticle: "Art. 458" },
    { taxType: "impozit_cladiri_nerezidentiale", category: null, zona: "B", rang: null, rateType: "percent", rateValue: 0.01, unit: null, descriptionRo: "Clădiri nerezidențiale, zona B — 1.0%", legalArticle: "Art. 458" },
    { taxType: "impozit_cladiri_nerezidentiale", category: null, zona: "C", rang: null, rateType: "percent", rateValue: 0.01, unit: null, descriptionRo: "Clădiri nerezidențiale, zona C — 1.0%", legalArticle: "Art. 458" },
    { taxType: "impozit_cladiri_nerezidentiale", category: null, zona: "D", rang: null, rateType: "percent", rateValue: 0.01, unit: null, descriptionRo: "Clădiri nerezidențiale, zona D — 1.0%", legalArticle: "Art. 458" },

    // Land rates — intravilan_curti
    { taxType: "impozit_teren_intravilan", category: "intravilan_curti", zona: "A", rang: null, rateType: "per_unit", rateValue: 1.5, unit: "lei/mp", descriptionRo: "Teren intravilan curți, zona A — 1.50 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_intravilan", category: "intravilan_curti", zona: "B", rang: null, rateType: "per_unit", rateValue: 1.1, unit: "lei/mp", descriptionRo: "Teren intravilan curți, zona B — 1.10 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_intravilan", category: "intravilan_curti", zona: "C", rang: null, rateType: "per_unit", rateValue: 0.8, unit: "lei/mp", descriptionRo: "Teren intravilan curți, zona C — 0.80 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_intravilan", category: "intravilan_curti", zona: "D", rang: null, rateType: "per_unit", rateValue: 0.5, unit: "lei/mp", descriptionRo: "Teren intravilan curți, zona D — 0.50 lei/mp", legalArticle: "Art. 465" },

    // Land rates — intravilan_arabil
    { taxType: "impozit_teren_intravilan", category: "intravilan_arabil", zona: "A", rang: null, rateType: "per_unit", rateValue: 0.8, unit: "lei/mp", descriptionRo: "Teren intravilan arabil, zona A — 0.80 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_intravilan", category: "intravilan_arabil", zona: "B", rang: null, rateType: "per_unit", rateValue: 0.6, unit: "lei/mp", descriptionRo: "Teren intravilan arabil, zona B — 0.60 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_intravilan", category: "intravilan_arabil", zona: "C", rang: null, rateType: "per_unit", rateValue: 0.4, unit: "lei/mp", descriptionRo: "Teren intravilan arabil, zona C — 0.40 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_intravilan", category: "intravilan_arabil", zona: "D", rang: null, rateType: "per_unit", rateValue: 0.2, unit: "lei/mp", descriptionRo: "Teren intravilan arabil, zona D — 0.20 lei/mp", legalArticle: "Art. 465" },

    // Land rates — extravilan
    { taxType: "impozit_teren_extravilan", category: "extravilan_arabil", zona: null, rang: null, rateType: "per_unit", rateValue: 50, unit: "lei/ha", descriptionRo: "Teren extravilan arabil — 50 lei/ha", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_extravilan", category: "extravilan_pasuni", zona: null, rang: null, rateType: "per_unit", rateValue: 28, unit: "lei/ha", descriptionRo: "Teren extravilan pășuni — 28 lei/ha", legalArticle: "Art. 465" },

    // Land rates — curti constructii
    { taxType: "impozit_teren_curti", category: "intravilan_curti", zona: "A", rang: null, rateType: "per_unit", rateValue: 1.5, unit: "lei/mp", descriptionRo: "Teren curți construcții, zona A — 1.50 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_curti", category: "intravilan_curti", zona: "B", rang: null, rateType: "per_unit", rateValue: 1.1, unit: "lei/mp", descriptionRo: "Teren curți construcții, zona B — 1.10 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_curti", category: "intravilan_curti", zona: "C", rang: null, rateType: "per_unit", rateValue: 0.8, unit: "lei/mp", descriptionRo: "Teren curți construcții, zona C — 0.80 lei/mp", legalArticle: "Art. 465" },
    { taxType: "impozit_teren_curti", category: "intravilan_curti", zona: "D", rang: null, rateType: "per_unit", rateValue: 0.3, unit: "lei/mp", descriptionRo: "Teren curți construcții, zona D — 0.30 lei/mp", legalArticle: "Art. 465" },

    // Vehicle rates — autoturisme by cc bracket
    { taxType: "impozit_mijloace_transport", category: "autoturism_sub_1600", zona: null, rang: 1, rateType: "per_unit", rateValue: 8, unit: "lei/200cc", descriptionRo: "Autoturism sub 1600 cmc — 8 lei/200 cmc", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "autoturism_1601_2000", zona: null, rang: 2, rateType: "per_unit", rateValue: 18, unit: "lei/200cc", descriptionRo: "Autoturism 1601–2000 cmc — 18 lei/200 cmc", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "autoturism_2001_2600", zona: null, rang: 3, rateType: "per_unit", rateValue: 36, unit: "lei/200cc", descriptionRo: "Autoturism 2001–2600 cmc — 36 lei/200 cmc", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "autoturism_2601_3000", zona: null, rang: 4, rateType: "per_unit", rateValue: 72, unit: "lei/200cc", descriptionRo: "Autoturism 2601–3000 cmc — 72 lei/200 cmc", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "autoturism_peste_3000", zona: null, rang: 5, rateType: "per_unit", rateValue: 144, unit: "lei/200cc", descriptionRo: "Autoturism peste 3000 cmc — 144 lei/200 cmc", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "autobuz", zona: null, rang: 6, rateType: "per_unit", rateValue: 24, unit: "lei/loc", descriptionRo: "Autobuz — 24 lei/loc", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "camion", zona: null, rang: 7, rateType: "per_unit", rateValue: 30, unit: "lei/tona", descriptionRo: "Camion — 30 lei/tonă", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "motocicleta_sub_200", zona: null, rang: 8, rateType: "fixed", rateValue: 8, unit: "lei", descriptionRo: "Motocicletă sub 200 cmc — 8 lei", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "motocicleta_201_500", zona: null, rang: 9, rateType: "fixed", rateValue: 18, unit: "lei", descriptionRo: "Motocicletă 201–500 cmc — 18 lei", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "motocicleta_peste_500", zona: null, rang: 10, rateType: "fixed", rateValue: 36, unit: "lei", descriptionRo: "Motocicletă peste 500 cmc — 36 lei", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "tractor", zona: null, rang: 11, rateType: "fixed", rateValue: 18, unit: "lei", descriptionRo: "Tractor — 18 lei", legalArticle: "Art. 470" },
    { taxType: "impozit_mijloace_transport", category: "remorca", zona: null, rang: 12, rateType: "fixed", rateValue: 12, unit: "lei", descriptionRo: "Remorcă (fallback) — 12 lei", legalArticle: "Art. 470" },
  ];

  // Delete existing rate tables for this HCL to avoid duplicates
  await prisma.taxRateTable.deleteMany({ where: { tenantId, hclDecisionId: hclId } });

  const rateTableIds: Record<string, string> = {};
  for (const rt of rateTables) {
    const created = await prisma.taxRateTable.create({
      data: {
        tenantId,
        hclDecisionId: hclId,
        taxType: rt.taxType,
        category: rt.category,
        zona: rt.zona,
        rang: rt.rang,
        rateType: rt.rateType,
        rateValue: rt.rateValue,
        unit: rt.unit,
        descriptionRo: rt.descriptionRo,
        legalArticle: rt.legalArticle,
      },
    });
    // Key: taxType|category|zona
    const key = `${rt.taxType}|${rt.category || ""}|${rt.zona || ""}`;
    rateTableIds[key] = created.id;
  }
  console.log(`Seeded HCL Decision 42/2025 with ${rateTables.length} rate tables`);

  // =============================================================================
  // 12. IMPOZITE (TAX RECORDS) — ~30
  // =============================================================================

  // Helper: find rate table ID by key
  function findRateId(taxType: string, category?: string, zona?: string): string | undefined {
    return rateTableIds[`${taxType}|${category || ""}|${zona || ""}`];
  }

  // Helper: compute vehicle tax
  function computeVehicleTax(tipVehicul: string, cilindreeCmc: number | null, masaTotalaKg: number | null, nrLocuri: number | null): { sumaCalculata: number; rataAplicata: number; bazaImpozabila: number; rateKey: string } {
    if (tipVehicul === "autoturism" && cilindreeCmc) {
      let ratePerUnit = 0;
      let cat = "";
      if (cilindreeCmc <= 1600) { ratePerUnit = 8; cat = "autoturism_sub_1600"; }
      else if (cilindreeCmc <= 2000) { ratePerUnit = 18; cat = "autoturism_1601_2000"; }
      else if (cilindreeCmc <= 2600) { ratePerUnit = 36; cat = "autoturism_2001_2600"; }
      else if (cilindreeCmc <= 3000) { ratePerUnit = 72; cat = "autoturism_2601_3000"; }
      else { ratePerUnit = 144; cat = "autoturism_peste_3000"; }
      const units = Math.ceil(cilindreeCmc / 200);
      return { sumaCalculata: units * ratePerUnit, rataAplicata: ratePerUnit, bazaImpozabila: cilindreeCmc, rateKey: `impozit_mijloace_transport|${cat}|` };
    }
    if (tipVehicul === "camion" && masaTotalaKg) {
      const tons = masaTotalaKg / 1000;
      return { sumaCalculata: Math.round(tons * 30), rataAplicata: 30, bazaImpozabila: masaTotalaKg, rateKey: "impozit_mijloace_transport|camion|" };
    }
    if (tipVehicul === "autobuz" && nrLocuri) {
      return { sumaCalculata: nrLocuri * 24, rataAplicata: 24, bazaImpozabila: nrLocuri, rateKey: "impozit_mijloace_transport|autobuz|" };
    }
    if (tipVehicul === "motocicleta" && cilindreeCmc) {
      if (cilindreeCmc <= 200) return { sumaCalculata: 8, rataAplicata: 8, bazaImpozabila: cilindreeCmc, rateKey: "impozit_mijloace_transport|motocicleta_sub_200|" };
      if (cilindreeCmc <= 500) return { sumaCalculata: 18, rataAplicata: 18, bazaImpozabila: cilindreeCmc, rateKey: "impozit_mijloace_transport|motocicleta_201_500|" };
      return { sumaCalculata: 36, rataAplicata: 36, bazaImpozabila: cilindreeCmc, rateKey: "impozit_mijloace_transport|motocicleta_peste_500|" };
    }
    // Tractor — treat as fixed
    return { sumaCalculata: 50, rataAplicata: 50, bazaImpozabila: 1, rateKey: "impozit_mijloace_transport||" };
  }

  const existingImpozite = await prisma.impozit.count({ where: { tenantId } });
  const impozitRecords: Array<{
    id: string;
    contribuabilIdx: number;
    status: string;
    sumaDatorata: number;
    sumaPlatita: number;
  }> = [];

  if (existingImpozite === 0) {
    // --- Building taxes (10 from residential, 5 from non-residential = 15) ---
    const buildingTaxConfigs = [
      // Residential beton zona A (first 5)
      { buildingIdx: 0, contribuabilIdx: 0, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "emis" },
      { buildingIdx: 1, contribuabilIdx: 1, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "platit" },
      { buildingIdx: 2, contribuabilIdx: 2, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "partial_platit" },
      { buildingIdx: 3, contribuabilIdx: 3, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "calculat" },
      { buildingIdx: 4, contribuabilIdx: 4, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "emis" },
      // Residential beton zona B (2)
      { buildingIdx: 10, contribuabilIdx: 10, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|B", taxTypeCode: "impozit_cladiri_rezidentiale", status: "emis" },
      { buildingIdx: 11, contribuabilIdx: 11, rateKey: "impozit_cladiri_rezidentiale|cadre_beton|B", taxTypeCode: "impozit_cladiri_rezidentiale", status: "platit" },
      // Residential caramida zona A (2)
      { buildingIdx: 15, contribuabilIdx: 15, rateKey: "impozit_cladiri_rezidentiale|pereti_caramida|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "emis" },
      { buildingIdx: 16, contribuabilIdx: 16, rateKey: "impozit_cladiri_rezidentiale|pereti_caramida|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "calculat" },
      // Residential lemn zona A (1)
      { buildingIdx: 25, contribuabilIdx: 25, rateKey: "impozit_cladiri_rezidentiale|lemn|A", taxTypeCode: "impozit_cladiri_rezidentiale", status: "emis" },
      // Non-residential (5)
      { buildingIdx: 32, contribuabilIdx: 35, rateKey: "impozit_cladiri_nerezidentiale||A", taxTypeCode: "impozit_cladiri_nerezidentiale", status: "emis" },
      { buildingIdx: 33, contribuabilIdx: 36, rateKey: "impozit_cladiri_nerezidentiale||A", taxTypeCode: "impozit_cladiri_nerezidentiale", status: "platit" },
      { buildingIdx: 34, contribuabilIdx: 37, rateKey: "impozit_cladiri_nerezidentiale||B", taxTypeCode: "impozit_cladiri_nerezidentiale", status: "partial_platit" },
      { buildingIdx: 35, contribuabilIdx: 38, rateKey: "impozit_cladiri_nerezidentiale||A", taxTypeCode: "impozit_cladiri_nerezidentiale", status: "calculat" },
      { buildingIdx: 36, contribuabilIdx: 39, rateKey: "impozit_cladiri_nerezidentiale||A", taxTypeCode: "impozit_cladiri_nerezidentiale", status: "emis" },
    ];

    for (const btc of buildingTaxConfigs) {
      const building = buildingConfigs[btc.buildingIdx];
      const rateId = rateTableIds[btc.rateKey];
      const rateEntry = rateTables.find((r) => `${r.taxType}|${r.category || ""}|${r.zona || ""}` === btc.rateKey);
      if (!rateEntry || !rateId) continue;

      const valoare = building.valoareImpozabila;
      const sumaCalculata = Math.round(valoare * rateEntry.rateValue * 100) / 100;
      const sumaDatorata = sumaCalculata;
      const rata1 = Math.round(sumaDatorata / 2 * 100) / 100;
      const rata2 = sumaDatorata - rata1;
      let sumaPlatita = 0;
      if (btc.status === "platit") sumaPlatita = sumaDatorata;
      else if (btc.status === "partial_platit") sumaPlatita = rata1;

      const imp = await prisma.impozit.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[btc.contribuabilIdx],
          taxTypeId: taxTypeMap[btc.taxTypeCode],
          fiscalYear: 2026,
          proprietateType: "cladire",
          proprietateId: buildingIds[btc.buildingIdx],
          dataStartCalcul: new Date("2026-01-01"),
          dataStopCalcul: new Date("2026-12-31"),
          nrLuni: 12,
          bonificatie: 0,
          hclDecisionId: hclId,
          rateTableId: rateId,
          bazaImpozabila: valoare,
          rataAplicata: rateEntry.rateValue,
          sumaCalculata,
          sumaScutire: 0,
          sumaDatorata,
          rata1,
          rata1Scadenta: new Date("2026-03-31"),
          rata2,
          rata2Scadenta: new Date("2026-09-30"),
          sumaPlatita,
          sumaPenalitati: 0,
          status: btc.status,
        },
      });
      impozitRecords.push({
        id: imp.id,
        contribuabilIdx: btc.contribuabilIdx,
        status: btc.status,
        sumaDatorata,
        sumaPlatita,
      });
    }

    // --- Land taxes (8) ---
    const landTaxConfigs = [
      // intravilan_curti zona A
      { landIdx: 0, contribuabilIdx: 0, taxTypeCode: "impozit_teren_intravilan", rateKey: "impozit_teren_intravilan|intravilan_curti|A", status: "emis" },
      { landIdx: 1, contribuabilIdx: 1, taxTypeCode: "impozit_teren_intravilan", rateKey: "impozit_teren_intravilan|intravilan_curti|A", status: "platit" },
      // intravilan_curti zona B
      { landIdx: 5, contribuabilIdx: 10, taxTypeCode: "impozit_teren_intravilan", rateKey: "impozit_teren_intravilan|intravilan_curti|B", status: "emis" },
      { landIdx: 6, contribuabilIdx: 11, taxTypeCode: "impozit_teren_intravilan", rateKey: "impozit_teren_intravilan|intravilan_curti|B", status: "partial_platit" },
      // intravilan_curti zona C
      { landIdx: 10, contribuabilIdx: 28, taxTypeCode: "impozit_teren_intravilan", rateKey: "impozit_teren_intravilan|intravilan_curti|C", status: "calculat" },
      // extravilan_arabil
      { landIdx: 15, contribuabilIdx: 6, taxTypeCode: "impozit_teren_extravilan", rateKey: "impozit_teren_extravilan|extravilan_arabil|", status: "emis" },
      { landIdx: 18, contribuabilIdx: 36, taxTypeCode: "impozit_teren_extravilan", rateKey: "impozit_teren_extravilan|extravilan_arabil|", status: "platit" },
      // extravilan_pasuni
      { landIdx: 22, contribuabilIdx: 17, taxTypeCode: "impozit_teren_extravilan", rateKey: "impozit_teren_extravilan|extravilan_pasuni|", status: "emis" },
    ];

    for (const ltc of landTaxConfigs) {
      const land = landConfigs[ltc.landIdx];
      const rateId = rateTableIds[ltc.rateKey];
      const rateEntry = rateTables.find((r) => `${r.taxType}|${r.category || ""}|${r.zona || ""}` === ltc.rateKey);
      if (!rateEntry || !rateId) continue;

      let bazaImpozabila: number;
      let sumaCalculata: number;

      if (rateEntry.unit === "lei/ha" && land.suprafataHa) {
        bazaImpozabila = land.suprafataHa;
        sumaCalculata = Math.round(land.suprafataHa * rateEntry.rateValue * 100) / 100;
      } else {
        bazaImpozabila = land.suprafataMp;
        sumaCalculata = Math.round(land.suprafataMp * rateEntry.rateValue * 100) / 100;
      }

      const sumaDatorata = sumaCalculata;
      const rata1 = Math.round(sumaDatorata / 2 * 100) / 100;
      const rata2 = sumaDatorata - rata1;
      let sumaPlatita = 0;
      if (ltc.status === "platit") sumaPlatita = sumaDatorata;
      else if (ltc.status === "partial_platit") sumaPlatita = rata1;

      const imp = await prisma.impozit.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[ltc.contribuabilIdx],
          taxTypeId: taxTypeMap[ltc.taxTypeCode],
          fiscalYear: 2026,
          proprietateType: "teren",
          proprietateId: landIds[ltc.landIdx],
          dataStartCalcul: new Date("2026-01-01"),
          dataStopCalcul: new Date("2026-12-31"),
          nrLuni: 12,
          bonificatie: 0,
          hclDecisionId: hclId,
          rateTableId: rateId,
          bazaImpozabila,
          rataAplicata: rateEntry.rateValue,
          sumaCalculata,
          sumaScutire: 0,
          sumaDatorata,
          rata1,
          rata1Scadenta: new Date("2026-03-31"),
          rata2,
          rata2Scadenta: new Date("2026-09-30"),
          sumaPlatita,
          sumaPenalitati: 0,
          status: ltc.status,
        },
      });
      impozitRecords.push({
        id: imp.id,
        contribuabilIdx: ltc.contribuabilIdx,
        status: ltc.status,
        sumaDatorata,
        sumaPlatita,
      });
    }

    // --- Vehicle taxes (7) ---
    const vehicleTaxIdxs = [0, 1, 3, 4, 7, 12, 15]; // indices into vehicleConfigs
    const vehicleTaxStatuses = ["emis", "platit", "emis", "partial_platit", "emis", "emis", "platit"];

    for (let vi = 0; vi < vehicleTaxIdxs.length; vi++) {
      const vIdx = vehicleTaxIdxs[vi];
      const vc = vehicleConfigs[vIdx];
      const vt = computeVehicleTax(vc.tipVehicul, vc.cilindreeCmc, vc.masaTotalaKg, vc.nrLocuri);
      const rateId = rateTableIds[vt.rateKey];
      const sumaDatorata = vt.sumaCalculata;
      const rata1 = Math.round(sumaDatorata / 2 * 100) / 100;
      const rata2 = sumaDatorata - rata1;
      const status = vehicleTaxStatuses[vi];
      let sumaPlatita = 0;
      if (status === "platit") sumaPlatita = sumaDatorata;
      else if (status === "partial_platit") sumaPlatita = rata1;

      const imp = await prisma.impozit.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[vc.contribuabilIdx],
          taxTypeId: taxTypeMap["impozit_mijloace_transport"],
          fiscalYear: 2026,
          proprietateType: "vehicul",
          proprietateId: vehicleIds[vIdx],
          dataStartCalcul: new Date("2026-01-01"),
          dataStopCalcul: new Date("2026-12-31"),
          nrLuni: 12,
          bonificatie: 0,
          hclDecisionId: hclId,
          rateTableId: rateId || undefined,
          bazaImpozabila: vt.bazaImpozabila,
          rataAplicata: vt.rataAplicata,
          sumaCalculata: vt.sumaCalculata,
          sumaScutire: 0,
          sumaDatorata,
          rata1,
          rata1Scadenta: new Date("2026-03-31"),
          rata2,
          rata2Scadenta: new Date("2026-09-30"),
          sumaPlatita,
          sumaPenalitati: 0,
          status,
        },
      });
      impozitRecords.push({
        id: imp.id,
        contribuabilIdx: vc.contribuabilIdx,
        status,
        sumaDatorata,
        sumaPlatita,
      });
    }

    console.log(`Seeded ${impozitRecords.length} tax records (impozite)`);
  } else {
    console.log(`Skipping impozite — ${existingImpozite} already exist`);
    const existingImp = await prisma.impozit.findMany({
      where: { tenantId },
      select: { id: true, contribuabilId: true, status: true, sumaDatorata: true, sumaPlatita: true },
      orderBy: { createdAt: "asc" },
    });
    for (const imp of existingImp) {
      const cIdx = contribuabilIds.indexOf(imp.contribuabilId);
      impozitRecords.push({
        id: imp.id,
        contribuabilIdx: cIdx >= 0 ? cIdx : 0,
        status: imp.status,
        sumaDatorata: Number(imp.sumaDatorata),
        sumaPlatita: Number(imp.sumaPlatita),
      });
    }
  }

  // =============================================================================
  // 13. PENALTIES (on overdue debts)
  // =============================================================================

  const overdueImpozite = impozitRecords.filter(
    (imp) => imp.status === "emis" || imp.status === "partial_platit"
  );

  const existingPenalties = await prisma.penalitate.count({ where: { tenantId } });
  if (existingPenalties === 0 && overdueImpozite.length > 0) {
    // Add penalties to the first 5 overdue records
    const penaltyTargets = overdueImpozite.slice(0, 5);
    for (const target of penaltyTargets) {
      const restanta = target.sumaDatorata - target.sumaPlatita;
      const rataPenalizare = 0.01; // 1% per month
      const sumaPenalizare = Math.round(restanta * rataPenalizare * 100) / 100;
      await prisma.penalitate.create({
        data: {
          tenantId,
          impozitId: target.id,
          dataCalcul: new Date("2026-04-01"),
          sumaRestanta: restanta,
          rataPenalizare,
          sumaPenalizare,
        },
      });
      // Update the impozit penalty total
      await prisma.impozit.update({
        where: { id: target.id },
        data: { sumaPenalitati: sumaPenalizare },
      });
    }
    console.log(`Seeded ${penaltyTargets.length} penalties`);
  } else {
    console.log(`Skipping penalties — ${existingPenalties} already exist`);
  }

  // =============================================================================
  // 14. PAYMENTS (~15)
  // =============================================================================

  const existingPlati = await prisma.plata.count({ where: { tenantId } });
  if (existingPlati === 0) {
    const operatorId = staffUserIds["operator"];

    // Paid impozite
    const paidImpozite = impozitRecords.filter((imp) => imp.status === "platit");
    const partialPaidImpozite = impozitRecords.filter((imp) => imp.status === "partial_platit");

    const paymentData: Array<{
      contribuabilIdx: number;
      suma: number;
      dataPlata: Date;
      modalitate: string;
      nrChitanta: string | null;
      gatewayRef: string | null;
      impozitId: string;
      distribuit: boolean;
    }> = [];

    // Full payments for "platit" records
    for (let i = 0; i < paidImpozite.length && paymentData.length < 10; i++) {
      const imp = paidImpozite[i];
      const months = ["01", "02", "03", "01", "02", "03", "01", "02", "03", "01"];
      const days = ["15", "20", "10", "25", "05", "18", "22", "08", "12", "28"];
      const modalities = ["numerar", "virament", "ghiseul_ro", "numerar", "virament", "ghiseul_ro", "numerar", "virament", "numerar", "virament"];
      const dateStr = `2026-${months[i]}-${days[i]}`;
      paymentData.push({
        contribuabilIdx: imp.contribuabilIdx,
        suma: imp.sumaDatorata,
        dataPlata: new Date(dateStr),
        modalitate: modalities[i],
        nrChitanta: modalities[i] === "numerar" ? `CH-2026-${String(i + 1).padStart(4, "0")}` : null,
        gatewayRef: modalities[i] === "ghiseul_ro" ? `GR-2026-${String(i + 1).padStart(6, "0")}` : null,
        impozitId: imp.id,
        distribuit: true,
      });
    }

    // Partial payments for "partial_platit" records
    for (let i = 0; i < partialPaidImpozite.length && paymentData.length < 15; i++) {
      const imp = partialPaidImpozite[i];
      paymentData.push({
        contribuabilIdx: imp.contribuabilIdx,
        suma: imp.sumaPlatita,
        dataPlata: new Date(`2026-02-${String(10 + i).padStart(2, "0")}`),
        modalitate: i % 2 === 0 ? "numerar" : "virament",
        nrChitanta: i % 2 === 0 ? `CH-2026-P-${String(i + 1).padStart(4, "0")}` : null,
        gatewayRef: null,
        impozitId: imp.id,
        distribuit: true,
      });
    }

    // Fill remaining slots with some 2025 late payments
    while (paymentData.length < 15) {
      const idx = paymentData.length;
      const emis = impozitRecords.find((imp) => imp.status === "emis");
      if (!emis) break;
      paymentData.push({
        contribuabilIdx: emis.contribuabilIdx,
        suma: 50,
        dataPlata: new Date(`2025-11-${String(10 + idx).padStart(2, "0")}`),
        modalitate: "numerar",
        nrChitanta: `CH-2025-${String(idx + 1).padStart(4, "0")}`,
        gatewayRef: null,
        impozitId: emis.id,
        distribuit: false,
      });
    }

    for (const pd of paymentData) {
      const plata = await prisma.plata.create({
        data: {
          tenantId,
          contribuabilId: contribuabilIds[pd.contribuabilIdx],
          suma: pd.suma,
          dataPlata: pd.dataPlata,
          modalitate: pd.modalitate,
          nrChitanta: pd.nrChitanta,
          gatewayRef: pd.gatewayRef,
          distribuit: pd.distribuit,
          inregistratDeId: operatorId,
        },
      });

      // Create distribution record
      if (pd.distribuit) {
        await prisma.plataDistributie.create({
          data: {
            tenantId,
            plataId: plata.id,
            impozitId: pd.impozitId,
            sumaDebit: pd.suma,
            sumaPenalitati: 0,
          },
        });
      }
    }
    console.log(`Seeded ${paymentData.length} payments with distributions`);
  } else {
    console.log(`Skipping payments — ${existingPlati} already exist`);
  }

  // =============================================================================
  // 15. DEMO CITIZEN ACCOUNT
  // =============================================================================

  const citizenEmail = "cetatean@example.ro";
  let citizenUser = await prisma.citizenUser.findFirst({
    where: { tenantId, email: citizenEmail },
  });

  if (!citizenUser) {
    citizenUser = await prisma.citizenUser.create({
      data: {
        tenantId,
        email: citizenEmail,
        passwordHash: await hash(SEED_PASSWORD, 12),
        firstName: "Ion",
        lastName: "Popescu",
        phone: "0740100001",
        emailVerified: true,
        isActive: true,
        limbaPreferata: "ro",
      },
    });

    // Link citizen to the first contribuabil (Ion Popescu — PF)
    await prisma.citizenContribuabilLink.create({
      data: {
        tenantId,
        citizenUserId: citizenUser.id,
        contribuabilId: contribuabilIds[0],
        linkType: "owner",
        verifiedAt: new Date(),
        isActive: true,
      },
    });
    console.log(`Demo citizen: ${citizenEmail} linked to contribuabil Popescu Ion`);
  } else {
    console.log(`Demo citizen already exists: ${citizenEmail}`);
  }

  // =============================================================================
  // 16. TAX RATE TABLES 2025 (separate HCL)
  // =============================================================================

  await seedTaxRates2025(prisma, tenantId);

  // =============================================================================
  // 17. BUDGET CLASSIFICATION CODES
  // =============================================================================

  await seedBudgetCodes(prisma);

  // =============================================================================
  // DONE
  // =============================================================================

  console.log("\n=== Seeding complete! ===");
  console.log("Summary:");
  console.log(`  - ${taxTypes.length} tax types in registry`);
  console.log(`  - Platform tenant + super admin`);
  console.log(`  - Demo tenant: ${demoTenant.name}`);
  console.log(`  - ${demoUsers.length} staff users (admin, operator, contabil)`);
  console.log(`  - ${zones.length} fiscal zones (A-D)`);
  console.log(`  - ${allAddresses.length} addresses`);
  console.log(`  - ${contribuabilIds.length} contribuabili (35 PF + 15 PJ)`);
  console.log(`  - ${buildingIds.length} buildings`);
  console.log(`  - ${landIds.length} land parcels`);
  console.log(`  - ${vehicleIds.length} vehicles`);
  console.log(`  - HCL Decision 42/2025 with ${rateTables.length} rate tables`);
  console.log(`  - ${impozitRecords.length} tax records`);
  console.log(`  - Penalties on overdue debts`);
  console.log(`  - Payments with distributions`);
  console.log(`  - Demo citizen: ${citizenEmail}`);
  console.log("\n=== Demo login credentials (local dev only — not committed) ===");
  console.log(`  Password for all demo accounts: ${SEED_PASSWORD}`);
  console.log(`  Admin:    admin@bogdanvoda.ro`);
  console.log(`  Operator: operator@bogdanvoda.ro`);
  console.log(`  Contabil: contabil@bogdanvoda.ro`);
  console.log(`  Citizen:  ${citizenEmail}`);
  console.log("===============================================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
