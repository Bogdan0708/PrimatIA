import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Building2, CreditCard, FileSearch, FileText, Phone, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PublicLandingPage() {
  const session = await auth();
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  // If staff is logged in, redirect to admin dashboard
  if (session?.user && session.user.role !== "cetatean") {
    redirect(`${localePrefix}/dashboard`);
  }

  const t = await getTranslations("landing");

  // Get the first active tenant for display
  const tenant = await prisma.tenant.findFirst({
    where: { status: "active", deletedAt: null },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero */}
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold">PrimărIA</span>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost">
                <Link href={`${localePrefix}/portal/login`}>
                  {t("citizenPortal")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${localePrefix}/login`}>{t("staffLogin")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              {tenant?.name || t("defaultTitle")}
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              {t("heroSubtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg">
                <Link href={`${localePrefix}/portal/login`}>
                  <CreditCard className="mr-2 h-5 w-5" />
                  {t("payTaxes")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg">
                <Link href={`${localePrefix}/portal/register`}>
                  <FileSearch className="mr-2 h-5 w-5" />
                  {t("checkStatus")}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-10">{t("quickLinks")}</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CreditCard className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("payOnline")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{t("payOnlineDesc")}</p>
                  <Button asChild variant="link" className="p-0">
                    <Link href={`${localePrefix}/portal/login`}>
                      {t("accessPortal")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("fiscalCertificate")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{t("fiscalCertificateDesc")}</p>
                  <Button asChild variant="link" className="p-0">
                    <Link href={`${localePrefix}/portal/certificate`}>
                      {t("requestOnline")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <FileSearch className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{t("checkFiscalStatus")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{t("checkFiscalStatusDesc")}</p>
                  <Button asChild variant="link" className="p-0">
                    <Link href={`${localePrefix}/portal/register`}>
                      {t("createAccount")}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Municipality info */}
        {tenant && (
          <section className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-center mb-10">{t("municipalityInfo")}</h2>
              <div className="grid gap-6 md:grid-cols-3">
                {tenant.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t("address")}</p>
                      <p className="text-sm text-muted-foreground">{tenant.address}</p>
                    </div>
                  </div>
                )}
                {tenant.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t("phone")}</p>
                      <p className="text-sm text-muted-foreground">{tenant.phone}</p>
                    </div>
                  </div>
                )}
                {tenant.email && (
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">{t("email")}</p>
                      <p className="text-sm text-muted-foreground">{tenant.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="h-5 w-5" />
            <span className="font-semibold text-white">PrimărIA</span>
          </div>
          <p className="text-sm">{t("footerText")}</p>
          <p className="text-xs mt-2">© {new Date().getFullYear()} PrimărIA — {t("copyright")}</p>
        </div>
      </footer>
    </div>
  );
}
