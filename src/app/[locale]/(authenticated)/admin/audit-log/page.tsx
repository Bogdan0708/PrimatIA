import { requireAdmin } from "@/lib/auth-utils";
import { prisma, setTenantContext } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTION_COLORS: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  delete: "destructive",
  cancel: "destructive",
  suspend: "destructive",
  create: "default",
  update: "secondary",
  sync: "outline",
  reactivate: "default",
};

function getActionVariant(action: string): "destructive" | "default" | "secondary" | "outline" {
  for (const [key, variant] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return variant;
  }
  return "outline";
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; limit?: string };
}) {
  const session = await requireAdmin();
  const t = await getTranslations("auditLog");
  await setTenantContext(session.user.tenantId);

  const page = parseInt(searchParams.page || "1");
  const limit = parseInt(searchParams.limit || "50");
  const skip = (page - 1) * limit;

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({
      where: { tenantId: session.user.tenantId },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  // Aggregate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [countToday, countWeek, uniqueUsers] = await Promise.all([
    prisma.auditLog.count({
      where: {
        tenantId: session.user.tenantId,
        createdAt: { gte: today },
      },
    }),
    prisma.auditLog.count({
      where: {
        tenantId: session.user.tenantId,
        createdAt: { gte: weekAgo },
      },
    }),
    // This is an approximation for unique users in the current view or we can do a full count
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { tenantId: session.user.tenantId },
      _count: true,
    }).then(res => res.length),
  ]);

  const stats = {
    total: totalCount,
    today: countToday,
    thisWeek: countWeek,
    uniqueUsers,
  };

  // Get unique entity types and actions for display (from current page only for performance)
  const entityTypes = Array.from(new Set(logs.map((l) => l.entityType)));
  const actions = Array.from(new Set(logs.map((l) => l.action)));

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
            <CardDescription>{t("totalEntries")}</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("today")}</CardDescription>
            <CardTitle className="text-2xl">{stats.today}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("thisWeek")}</CardDescription>
            <CardTitle className="text-2xl">{stats.thisWeek}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("uniqueUsers")}</CardDescription>
            <CardTitle className="text-2xl">{stats.uniqueUsers}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters summary */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">{t("entityTypes")}:</span>
        {entityTypes.map((et) => (
          <Badge key={et} variant="outline" className="text-xs">
            {et}
          </Badge>
        ))}
        <span className="ml-4 text-sm text-muted-foreground">{t("actions")}:</span>
        {actions.slice(0, 8).map((a) => (
          <Badge key={a} variant="outline" className="text-xs">
            {a}
          </Badge>
        ))}
        {actions.length > 8 && (
          <Badge variant="outline" className="text-xs">
            +{actions.length - 8}
          </Badge>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t("logEntries")}</CardTitle>
            <CardDescription>{t("logEntriesDesc")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={`?page=${page - 1}&limit=${limit}`}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t("previous", { defaultValue: "Anterior" })}
              </Link>
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("pageInfo", { current: page, total: totalPages, defaultValue: `Pagina ${page} din ${totalPages}` })}
            </span>
            <Button
              variant="outline"
              size="sm"
              asChild
              disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={`?page=${page + 1}&limit=${limit}`}>
                {t("next", { defaultValue: "Următor" })}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noEntries")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">{t("timestamp")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("entityType")}</TableHead>
                    <TableHead>{t("entityId")}</TableHead>
                    <TableHead>{t("userId")}</TableHead>
                    <TableHead className="max-w-xs">{t("changes")}</TableHead>
                    <TableHead>{t("ipAddress")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("ro-RO", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionVariant(log.action)} className="text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.entityType}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.entityId ? log.entityId.slice(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.userId ? log.userId.slice(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {log.newValues ? (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-primary hover:underline">
                              {t("viewChanges")}
                            </summary>
                            <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-[10px]">
                              {JSON.stringify(log.newValues, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.ipAddress || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
