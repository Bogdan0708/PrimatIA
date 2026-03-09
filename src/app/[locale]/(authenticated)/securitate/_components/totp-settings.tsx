"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TotpSettingsProps {
  enabled: boolean;
}

interface SetupState {
  secret: string;
  formattedSecret: string;
}

export function TotpSettings({ enabled }: TotpSettingsProps) {
  const t = useTranslations("security");
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [enableCode, setEnableCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const startSetup = async () => {
    clearMessages();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/totp/setup", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("setupFailed"));
        return;
      }
      setSetup({
        secret: data.secret,
        formattedSecret: data.formattedSecret,
      });
    } finally {
      setLoading(false);
    }
  };

  const enableTotp = async () => {
    clearMessages();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: enableCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("enableFailed"));
        return;
      }
      setIsEnabled(true);
      setSetup(null);
      setEnableCode("");
      setSuccess(t("enabledSuccess"));
    } finally {
      setLoading(false);
    }
  };

  const disableTotp = async () => {
    clearMessages();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("disableFailed"));
        return;
      }
      setIsEnabled(false);
      setSetup(null);
      setDisableCode("");
      setSuccess(t("disabledSuccess"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border p-4">
          <p className="text-sm font-medium">
            {isEnabled ? t("enabledLabel") : t("disabledLabel")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEnabled ? t("enabledDescription") : t("disabledDescription")}
          </p>
        </div>

        {!isEnabled && !setup && (
          <Button onClick={startSetup} disabled={loading}>
            {t("startSetup")}
          </Button>
        )}

        {!isEnabled && setup && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="manual-secret">{t("manualSecret")}</Label>
              <Input id="manual-secret" value={setup.formattedSecret} readOnly />
              <p className="text-xs text-muted-foreground">{t("manualSecretHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enable-code">{t("verificationCode")}</Label>
              <Input
                id="enable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={enableCode}
                onChange={(event) => setEnableCode(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={enableTotp} disabled={loading || enableCode.trim().length < 6}>
                {t("enable")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSetup(null);
                  setEnableCode("");
                  clearMessages();
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        )}

        {isEnabled && (
          <div className="space-y-4 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="disable-code">{t("verificationCode")}</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              onClick={disableTotp}
              disabled={loading || disableCode.trim().length < 6}
            >
              {t("disable")}
            </Button>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-green-600">{success}</p> : null}
      </CardContent>
    </Card>
  );
}
