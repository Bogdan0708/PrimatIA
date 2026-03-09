import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TotpSettings } from "./_components/totp-settings";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("security");

  const user = await prisma.tenantUser.findFirst({
    where: {
      id: session.user.id,
      tenantId: session.user.tenantId,
      deletedAt: null,
    },
    select: {
      totpSecret: true,
    },
  });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageDescription")}</p>
      </div>
      <TotpSettings enabled={Boolean(user?.totpSecret)} />
    </section>
  );
}
