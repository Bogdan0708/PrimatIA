import { PrismaClient } from "@prisma/client";

const BUDGET_CODES = [
  { code: "07.02.01.01", nameRo: "Impozit pe clădiri PF", category: "venituri", parentCode: "07.02.01" },
  { code: "07.02.01.02", nameRo: "Impozit pe clădiri PJ", category: "venituri", parentCode: "07.02.01" },
  { code: "07.02.02.01", nameRo: "Impozit pe teren intravilan", category: "venituri", parentCode: "07.02.02" },
  { code: "07.02.02.02", nameRo: "Impozit pe teren extravilan", category: "venituri", parentCode: "07.02.02" },
  { code: "07.02.03", nameRo: "Taxe judiciare de timbru", category: "venituri", parentCode: "07.02" },
  { code: "07.02.05", nameRo: "Alte impozite și taxe pe proprietate", category: "venituri", parentCode: "07.02" },
  { code: "16.02.02.01", nameRo: "Impozit pe mijloace de transport PF", category: "venituri", parentCode: "16.02.02" },
  { code: "16.02.02.02", nameRo: "Impozit pe mijloace de transport PJ", category: "venituri", parentCode: "16.02.02" },
];

export async function seedBudgetCodes(prisma: PrismaClient) {
  console.log("Seeding budget codes...");
  for (const bc of BUDGET_CODES) {
    await prisma.budgetCode.upsert({
      where: { code: bc.code },
      update: { nameRo: bc.nameRo, category: bc.category, parentCode: bc.parentCode },
      create: bc,
    });
  }
  console.log(`Seeded ${BUDGET_CODES.length} budget codes.`);
}
