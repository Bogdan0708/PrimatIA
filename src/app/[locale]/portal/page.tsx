import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLocale } from "next-intl/server";

export default async function PortalPage() {
  const session = await auth();
  const locale = await getLocale();
  if (session?.user && session.user.role === "cetatean") {
    redirect(`/${locale}/portal/dashboard`);
  }
  redirect(`/${locale}/portal/login`);
}
