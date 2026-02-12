import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function PortalPage() {
  const session = await auth();
  if (session?.user && session.user.role === "cetatean") {
    redirect("/portal/dashboard");
  }
  redirect("/portal/login");
}
