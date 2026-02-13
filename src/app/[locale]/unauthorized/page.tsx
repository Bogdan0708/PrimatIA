import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
import { getLocale } from "next-intl/server";

export default async function UnauthorizedPage() {
  const locale = await getLocale();
  const localePrefix = `/${locale}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <ShieldX className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-bold mb-2">Acces interzis</h1>
      <p className="text-muted-foreground mb-6">
        Nu aveți permisiunile necesare pentru a accesa această pagină.
      </p>
      <Link href={`${localePrefix}/dashboard`}>
        <Button>Înapoi la panou principal</Button>
      </Link>
    </div>
  );
}
