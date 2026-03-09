"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Building2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RegistrationState = "form" | "success";

export default function PortalRegisterPage() {
  const [state, setState] = useState<RegistrationState>("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipContribuabil, setTipContribuabil] = useState("PF");
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const localePrefix = `/${locale}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/portal/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          password,
          tip: tipContribuabil,
          cnp: tipContribuabil === "PF" ? formData.get("cnp") : undefined,
          cui: tipContribuabil === "PJ" ? formData.get("cui") : undefined,
          phone: formData.get("phone"),
          limbaPreferata: formData.get("limbaPreferata") || "ro",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("registrationError"));
      } else {
        setState("success");
      }
    } catch {
      setError(t("registrationError"));
    } finally {
      setLoading(false);
    }
  };

  if (state === "success") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-portal-primary" />
            </div>
            <CardTitle>{t("registrationSuccess")}</CardTitle>
            <CardDescription>{t("checkEmail")}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild variant="outline">
              <Link href={`${localePrefix}/portal/login`}>
                {t("backToLogin")}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-portal-primary" />
              <span className="text-2xl font-bold">PrimărIA</span>
            </div>
          </div>
          <CardTitle className="text-2xl">{t("createAccount")}</CardTitle>
          <CardDescription>{t("registerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("lastName")}</Label>
                <Input id="lastName" name="lastName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("firstName")}</Label>
                <Input id="firstName" name="firstName" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" required />
            </div>

            <div className="space-y-2">
              <Label>{t("accountType")}</Label>
              <Select value={tipContribuabil} onValueChange={setTipContribuabil}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">{t("individual")}</SelectItem>
                  <SelectItem value="PJ">{t("company")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipContribuabil === "PF" ? (
              <div className="space-y-2">
                <Label htmlFor="cnp">{t("cnp")}</Label>
                <Input
                  id="cnp"
                  name="cnp"
                  maxLength={13}
                  pattern="[0-9]{13}"
                  required
                />
                <p className="text-xs text-muted-foreground">{t("cnpHelp")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="cui">{t("cui")}</Label>
                <Input id="cui" name="cui" required />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limbaPreferata">{t("preferredLanguage")}</Label>
              <Select name="limbaPreferata" defaultValue="ro">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ro">Română</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hu">Magyar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            <Button
              type="submit"
              className="w-full bg-portal-primary hover:bg-portal-primary-hover"
              disabled={loading}
            >
              {loading ? tCommon("loading") : t("register")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            {t("hasAccount")}{" "}
            <Link
              href={`${localePrefix}/portal/login`}
              className="text-portal-primary hover:underline font-medium"
            >
              {tCommon("login")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
