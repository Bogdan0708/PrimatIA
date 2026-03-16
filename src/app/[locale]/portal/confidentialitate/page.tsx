import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  const t = useTranslations("privacy");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-portal-primary" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none pt-6 space-y-6">
          {/* 1. Controller */}
          <section>
            <h2 className="text-lg font-semibold">{t("controllerTitle")}</h2>
            <p>{t("controllerText")}</p>
          </section>

          {/* 2. DPO */}
          <section>
            <h2 className="text-lg font-semibold">{t("dpoTitle")}</h2>
            <p>{t("dpoText")}</p>
          </section>

          {/* 3. Legal basis */}
          <section>
            <h2 className="text-lg font-semibold">{t("legalBasisTitle")}</h2>
            <p>{t("legalBasisText")}</p>
          </section>

          {/* 4. Data categories */}
          <section>
            <h2 className="text-lg font-semibold">{t("dataCategoriesTitle")}</h2>
            <p>{t("dataCategoriesText")}</p>
          </section>

          {/* 5. Purpose */}
          <section>
            <h2 className="text-lg font-semibold">{t("purposeTitle")}</h2>
            <p>{t("purposeText")}</p>
          </section>

          {/* 6. Retention */}
          <section>
            <h2 className="text-lg font-semibold">{t("retentionTitle")}</h2>
            <p>{t("retentionText")}</p>
          </section>

          {/* 7. Rights */}
          <section>
            <h2 className="text-lg font-semibold">{t("rightsTitle")}</h2>
            <p>{t("rightsText")}</p>
          </section>

          {/* 8. ANSPDCP */}
          <section>
            <h2 className="text-lg font-semibold">{t("anspdcpTitle")}</h2>
            <p>{t("anspdcpText")}</p>
          </section>

          {/* 9. Cookies */}
          <section>
            <h2 className="text-lg font-semibold">{t("cookiesTitle")}</h2>
            <p>{t("cookiesText")}</p>
          </section>

          {/* 10. Processor */}
          <section>
            <h2 className="text-lg font-semibold">{t("processorTitle")}</h2>
            <p>{t("processorText")}</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
