import { verifyCitizenEmail } from "@/lib/citizen-auth";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {success ? (
              <CheckCircle className="h-16 w-16 text-teal-600" />
            ) : (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle>
            {success ? "Email verificat cu succes!" : "Link invalid sau expirat"}
          </CardTitle>
          <CardDescription>
            {success
              ? "Contul dumneavoastră a fost activat. Puteți acum să vă autentificați."
              : "Link-ul de verificare este invalid sau a expirat. Vă rugăm să vă înregistrați din nou."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild className={success ? "bg-teal-600 hover:bg-teal-700" : ""}>
            <Link href="/portal/login">
              {success ? "Autentificare" : "Înapoi la înregistrare"}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
