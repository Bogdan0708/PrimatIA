"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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

export default function PortalResetPasswordPage() {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(t("resetPasswordInvalidToken"));
      return;
    }

    if (password.length < 12) {
      setError(t("resetPasswordMinLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("resetPasswordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/portal/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setError(tCommon("rateLimitExceeded"));
        } else {
          const data = await response.json();
          setError(data.error || t("resetPasswordError"));
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`${localePrefix}/portal/login`);
      }, 1200);
    } catch {
      setError(t("resetPasswordError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>{t("resetPasswordSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <p className="text-sm text-emerald-700">{t("resetPasswordSuccess")}</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive">{t("resetPasswordMismatch")}</p>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full bg-portal-primary hover:bg-portal-primary-hover" disabled={loading}>
                {loading ? tCommon("loading") : t("resetPasswordSubmit")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
