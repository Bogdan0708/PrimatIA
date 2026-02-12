import { requireAdmin } from "@/lib/auth-utils";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/formatting";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  sent: "default",
  delivered: "default",
  failed: "destructive",
  bounced: "destructive",
};

export default async function AdminNotificationsPage() {
  const session = await requireAdmin();
  const t = await getTranslations("notification");
  await setTenantContext(session.user.tenantId);

  const notifications = await prisma.notificare.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const stats = {
    total: notifications.length,
    sent: notifications.filter((n) => n.status === "sent" || n.status === "delivered").length,
    failed: notifications.filter((n) => n.status === "failed" || n.status === "bounced").length,
    pending: notifications.filter((n) => n.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("total")}</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("sent")}</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.sent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("failed")}</CardDescription>
            <CardTitle className="text-2xl text-destructive">{stats.failed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("pending")}</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Notification log */}
      <Card>
        <CardHeader>
          <CardTitle>{t("notificationLog")}</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noNotifications")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("recipient")}</TableHead>
                  <TableHead>{t("channel")}</TableHead>
                  <TableHead>{t("template")}</TableHead>
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("error")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notif) => (
                  <TableRow key={notif.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(notif.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {notif.recipientEmail || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{notif.canal}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{notif.template}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {notif.subject || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[notif.status] || "outline"}>
                        {t(`status_${notif.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {notif.errorMessage || ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
