import { PrismaClient } from "@prisma/client";

function parseArgs(argv) {
  const args = { mode: "checklist" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--mode") {
      const value = argv[++i];
      if (!value || !["checklist", "verify-import", "verify-rollback"].includes(value)) {
        throw new Error("Invalid --mode. Allowed: checklist | verify-import | verify-rollback");
      }
      args.mode = value;
      continue;
    }
    if (arg === "--tenant-id") {
      args.tenantId = argv[++i];
      continue;
    }
    if (arg === "--batch-id") {
      args.batchId = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  npm run ops:import-rehearsal -- --mode checklist --tenant-id <tenantId>",
    "  npm run ops:import-rehearsal -- --mode verify-import --tenant-id <tenantId> --batch-id <batchId>",
    "  npm run ops:import-rehearsal -- --mode verify-rollback --tenant-id <tenantId> --batch-id <batchId>",
  ].join("\n");
}

function fail(message) {
  throw new Error(message);
}

async function setTenantContext(prisma, tenantId) {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)`;
}

function printChecklist(tenantId) {
  console.log("Import/Rollback rehearsal checklist:");
  console.log("1) Run strict DB preflight:");
  console.log("   npm run db:preflight:strict");
  console.log("2) In staging UI: Admin > Import");
  console.log("   - Download template for target entity");
  console.log("   - Upload test CSV");
  console.log("   - Preview + validation report");
  console.log("   - Confirm import and execute");
  console.log("3) Capture batch ID from import history table.");
  console.log("4) Verify imported batch invariants:");
  console.log(
    `   npm run ops:import-rehearsal -- --mode verify-import --tenant-id ${tenantId || "<tenantId>"} --batch-id <batchId>`
  );
  console.log("5) Open batch detail page and execute rollback with confirmation.");
  console.log("6) Verify rollback invariants:");
  console.log(
    `   npm run ops:import-rehearsal -- --mode verify-rollback --tenant-id ${tenantId || "<tenantId>"} --batch-id <batchId>`
  );
}

async function verifyImport(prisma, tenantId, batchId) {
  await setTenantContext(prisma, tenantId);

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId },
    select: {
      id: true,
      status: true,
      importedRows: true,
      errorRows: true,
      totalRows: true,
      entityType: true,
    },
  });
  if (!batch) fail("Batch not found for tenant");

  if (!["completed", "completed_with_errors"].includes(batch.status)) {
    fail(`Unexpected batch status for import verification: ${batch.status}`);
  }

  const ledgers = await prisma.importRowLedger.groupBy({
    by: ["status"],
    where: { tenantId, batchId },
    _count: { _all: true },
  });
  const countByStatus = Object.fromEntries(ledgers.map((l) => [l.status, l._count._all]));
  const importedCount = countByStatus.imported || 0;
  const failedCount = countByStatus.failed || 0;

  if (importedCount !== batch.importedRows) {
    fail(`Mismatch: batch.importedRows=${batch.importedRows}, ledger.imported=${importedCount}`);
  }
  if (failedCount !== batch.errorRows) {
    fail(`Mismatch: batch.errorRows=${batch.errorRows}, ledger.failed=${failedCount}`);
  }
  if (importedCount + failedCount > batch.totalRows) {
    fail("Ledger counts exceed batch totalRows");
  }

  console.log("Import verification passed.");
  console.log(JSON.stringify({ batch, countByStatus }, null, 2));
}

async function verifyRollback(prisma, tenantId, batchId) {
  await setTenantContext(prisma, tenantId);

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, tenantId },
    select: { id: true, status: true, rollbackAt: true },
  });
  if (!batch) fail("Batch not found for tenant");
  if (batch.status !== "rolled_back") {
    fail(`Batch is not rolled_back (current: ${batch.status})`);
  }

  const ledgers = await prisma.importRowLedger.findMany({
    where: { tenantId, batchId, entityRecordId: { not: null } },
    select: { entityType: true, entityRecordId: true, status: true },
  });

  const nonRolledBack = ledgers.filter((l) => l.status !== "rolled_back");
  if (nonRolledBack.length > 0) {
    fail(`Found ${nonRolledBack.length} ledger rows not marked rolled_back`);
  }

  const contribuabilIds = ledgers
    .filter((l) => l.entityType === "contribuabil")
    .map((l) => l.entityRecordId);
  const cladireIds = ledgers
    .filter((l) => l.entityType === "proprietate_cladire")
    .map((l) => l.entityRecordId);
  const terenIds = ledgers
    .filter((l) => l.entityType === "proprietate_teren")
    .map((l) => l.entityRecordId);
  const vehiculIds = ledgers
    .filter((l) => l.entityType === "proprietate_vehicul")
    .map((l) => l.entityRecordId);

  const activeContribuabili = contribuabilIds.length
    ? await prisma.contribuabil.count({ where: { tenantId, id: { in: contribuabilIds }, deletedAt: null } })
    : 0;
  const activeCladiri = cladireIds.length
    ? await prisma.proprietateCladire.count({ where: { tenantId, id: { in: cladireIds }, deletedAt: null } })
    : 0;
  const activeTerenuri = terenIds.length
    ? await prisma.proprietateTeren.count({ where: { tenantId, id: { in: terenIds }, deletedAt: null } })
    : 0;
  const activeVehicule = vehiculIds.length
    ? await prisma.proprietateVehicul.count({ where: { tenantId, id: { in: vehiculIds }, deletedAt: null } })
    : 0;

  const activeTotal = activeContribuabili + activeCladiri + activeTerenuri + activeVehicule;
  if (activeTotal > 0) {
    fail(
      `Rollback incomplete: active records still present (${JSON.stringify({
        activeContribuabili,
        activeCladiri,
        activeTerenuri,
        activeVehicule,
      })})`
    );
  }

  console.log("Rollback verification passed.");
  console.log(
    JSON.stringify(
      {
        batch,
        ledgerRows: ledgers.length,
        activeCounts: {
          activeContribuabili,
          activeCladiri,
          activeTerenuri,
          activeVehicule,
        },
      },
      null,
      2
    )
  );
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error(usage());
    process.exit(1);
    return;
  }

  if (args.mode === "checklist") {
    printChecklist(args.tenantId);
    return;
  }

  if (!args.tenantId || !args.batchId) {
    console.error("--tenant-id and --batch-id are required for verification modes.");
    console.error(usage());
    process.exit(1);
    return;
  }

  const prisma = new PrismaClient({ log: ["error"] });
  try {
    if (args.mode === "verify-import") {
      await verifyImport(prisma, args.tenantId, args.batchId);
    } else if (args.mode === "verify-rollback") {
      await verifyRollback(prisma, args.tenantId, args.batchId);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

