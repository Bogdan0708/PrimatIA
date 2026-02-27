import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";
import { prisma, setTenantContext } from "@/lib/db";
import { getOutstanding, getTotalOwed } from "@/lib/tax-engine/liability-utils";

export async function GET(request: NextRequest) {
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await setTenantContext(citizen.tenantId);

  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  const taxes = await prisma.impozit.findMany({
    where: {
      contribuabilId: { in: contribuabilIds },
      status: { in: ["calculat", "emis", "partial_platit", "executare"] },
    },
    include: { taxType: true },
    orderBy: [{ fiscalYear: "asc" }, { createdAt: "asc" }],
  });

  const debts = taxes
    .filter((tax) => getOutstanding(tax) > 0)
    .map((tax) => ({
      impozitId: tax.id,
      contribuabilId: tax.contribuabilId,
      taxType: (tax.taxType.name as Record<string, string>)?.ro || tax.taxType.code,
      fiscalYear: tax.fiscalYear,
      amountOwed: Number(tax.sumaDatorata),
      penalties: Number(tax.sumaPenalitati),
      totalOwed: getTotalOwed(tax),
      amountPaid: Number(tax.sumaPlatita),
      outstanding: getOutstanding(tax),
    }));

  return NextResponse.json({ debts });
}
