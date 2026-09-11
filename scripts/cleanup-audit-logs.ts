/**
 * Cleanup expired audit logs.
 *
 * Romanian fiscal law requires 7-year retention for audit records.
 * This script deletes logs where expires_at < now().
 *
 * Usage: npx tsx scripts/cleanup-audit-logs.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const now = new Date();

  console.log(`[audit-cleanup] Starting at ${now.toISOString()}${dryRun ? " (DRY RUN)" : ""}`);

  // Count expired logs
  const expiredCount = await prisma.auditLog.count({
    where: {
      expiresAt: { lt: now },
    },
  });

  console.log(`[audit-cleanup] Found ${expiredCount} expired audit log(s)`);

  if (expiredCount === 0) {
    console.log("[audit-cleanup] Nothing to clean up");
    return;
  }

  if (dryRun) {
    console.log("[audit-cleanup] Dry run — no records deleted");
    return;
  }

  // Delete in batches to avoid long-running transactions
  const BATCH_SIZE = 1000;
  let totalDeleted = 0;

  while (totalDeleted < expiredCount) {
    const batch = await prisma.auditLog.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const deleted = await prisma.auditLog.deleteMany({
      where: { id: { in: batch.map((b) => b.id) } },
    });

    totalDeleted += deleted.count;
    console.log(`[audit-cleanup] Deleted ${totalDeleted}/${expiredCount}`);
  }

  console.log(`[audit-cleanup] Done. Deleted ${totalDeleted} expired audit log(s)`);
}

main()
  .catch((e) => {
    console.error("[audit-cleanup] Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
