import { verifyCitizenEmail } from "@/lib/citizen-auth";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLocale, getTranslations } from "next-intl/server";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let success = false;

  if (token) {
    success = await verifyCitizenEmail(token);
  }

  const locale = await getLocale();
  const localePrefix = `/${locale}`;
  const t = await getTranslations("portal");

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {success ? (
              <CheckCircle className="h-16 w-16 text-portal-primary" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle>
            {success ? t("verifySuccessTitle") : t("verifyFailTitle")}
          </CardTitle>
          <CardDescription>
            {success ? t("verifySuccessDescription") : t("verifyFailDescription")}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild className={success ? "bg-portal-primary hover:bg-portal-primary-hover" : ""}>
            <Link href={`${localePrefix}/portal/login`}>
              {success ? t("goToLogin") : t("backToRegister")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
