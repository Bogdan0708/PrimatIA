import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest, resolvePortalTenant } from "@/lib/portal-auth";
import { setTenantContext, prisma } from "@/lib/db";
import { generateTaxExplanation } from "@/lib/tax-engine/tax-explainer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const citizen = await getCitizenFromRequest(request);
  if (!citizen) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await resolvePortalTenant(request);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }
  await setTenantContext(tenantId);

  const { id: impozitId } = await params;

  // Verify the citizen has access to this tax record
  const links = await prisma.citizenContribuabilLink.findMany({
    where: { citizenUserId: citizen.sub, isActive: true },
    select: { contribuabilId: true },
  });
  const contribuabilIds = links.map((l) => l.contribuabilId);

  const tax = await prisma.impozit.findUnique({
    where: { id: impozitId },
    select: { contribuabilId: true },
  });

  if (!tax || !contribuabilIds.includes(tax.contribuabilId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const explanation = await generateTaxExplanation(impozitId);
  if (!explanation) {
    return NextResponse.json({ error: "Could not generate explanation" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: explanation });
}
