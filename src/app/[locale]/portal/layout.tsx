import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { PortalShell } from "@/components/portal/portal-shell";
import { ChatbotWidget } from "@/components/portal/chatbot-widget";

export const metadata = {
  title: "Portal Cetățean — PrimărIA",
  description: "Portal de self-service pentru cetățeni",
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <Providers locale={locale} messages={messages}>
      <div className="portal-theme">
        <PortalShell>{children}</PortalShell>
        <ChatbotWidget />
      </div>
    </Providers>
  );
}
