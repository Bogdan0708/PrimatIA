import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import type { Role } from "@/lib/constants";
import { getLocale } from "next-intl/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  let tenantName: string | undefined;
  if (session.user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true },
    });
    tenantName = tenant?.name;
  }

  const userName = `${session.user.firstName} ${session.user.lastName}`;

  return (
    <AppShell
      userName={userName}
      userRole={session.user.role as Role}
      tenantName={tenantName}
    >
      {children}
    </AppShell>
  );
}
