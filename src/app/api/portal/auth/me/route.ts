import { NextRequest, NextResponse } from "next/server";
import { getCitizenFromRequest } from "@/lib/portal-auth";

export async function GET(request: NextRequest) {
  const citizen = await getCitizenFromRequest(request);

  if (!citizen) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: citizen.sub,
    email: citizen.email,
    firstName: citizen.firstName,
    lastName: citizen.lastName,
    tenantId: citizen.tenantId,
    role: "cetatean",
  });
}
