"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LoginPage() {
  const roeidEnabled = process.env.NEXT_PUBLIC_ROEID_ENABLED === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("invalidCredentials"));
    } else {
      router.push(`${localePrefix}/dashboard`);
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="outline" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">PrimărIA</span>
            </div>
          </div>
          <CardTitle className="text-2xl">{t("signIn")}</CardTitle>
          <CardDescription>{t("welcomeBack")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="operator@primaria.ro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? tCommon("loading") : t("signIn")}
            </Button>
            <div className="text-center">
              <Link
                href={`${localePrefix}/forgot-password`}
                className="text-sm text-muted-foreground hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>
          </form>

          {/* ROeID Integration — Coming Soon */}
          <div className="mt-6 border-t pt-4">
            <div className="relative">
              <Button
                variant="outline"
                className="w-full border-blue-300 bg-gradient-to-r from-blue-50 to-yellow-50 text-blue-800 hover:from-blue-100 hover:to-yellow-100 dark:from-blue-950 dark:to-yellow-950 dark:text-blue-300"
                disabled
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="12" cy="11" r="3" />
                  <path d="M7 20v-1a5 5 0 0 1 10 0v1" />
                </svg>
                {t("roeidLogin")}
              </Button>
              <span className="absolute -top-2 right-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                {roeidEnabled ? t("roeidComingSoon") : t("roeidDisabled")}
              </span>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t("roeidDescription")}
            </p>
            <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {t("eidasCompliant")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
