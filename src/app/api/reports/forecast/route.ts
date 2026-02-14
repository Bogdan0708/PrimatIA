import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateRevenueForecast } from "@/lib/ai/revenue-forecast";
import { setTenantContext } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "super_admin" && role !== "primaria_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : undefined;

    if (yearParam && (isNaN(year!) || year! < 2000 || year! > 2100)) {
      return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
    }

    await setTenantContext(session.user.tenantId);
    const forecast = await generateRevenueForecast(session.user.tenantId, year);

    return NextResponse.json({ success: true, data: forecast });
  } catch (error) {
    console.error("Error generating forecast:", error);
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    );
  }
}
