#!/usr/bin/env bash
set -euo pipefail

RUN_IMPORT_VERIFY=0
RUN_ROLLBACK_VERIFY=0
TENANT_ID="${TENANT_ID:-}"
IMPORT_BATCH_ID="${IMPORT_BATCH_ID:-}"
ROLLBACK_BATCH_ID="${ROLLBACK_BATCH_ID:-}"

for arg in "$@"; do
  case "$arg" in
    --verify-import)
      RUN_IMPORT_VERIFY=1
      ;;
    --verify-rollback)
      RUN_ROLLBACK_VERIFY=1
      ;;
    --help)
      cat <<'USAGE'
Usage:
  bash scripts/staging-release-gate.sh [--verify-import] [--verify-rollback]

Environment variables:
  TENANT_ID           Required when using --verify-import/--verify-rollback
  IMPORT_BATCH_ID     Required when using --verify-import
  ROLLBACK_BATCH_ID   Required when using --verify-rollback

Examples:
  bash scripts/staging-release-gate.sh
  TENANT_ID=... IMPORT_BATCH_ID=... bash scripts/staging-release-gate.sh --verify-import
  TENANT_ID=... ROLLBACK_BATCH_ID=... bash scripts/staging-release-gate.sh --verify-rollback
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

echo "[staging-gate] Strict DB preflight"
npm run db:preflight:strict

echo "[staging-gate] Type check"
npm run type-check

echo "[staging-gate] Tests"
npm test

if [[ -n "${AI_GATEWAY_URL:-}" || -n "${AI_GATEWAY_KEY:-}" ]]; then
  : "${AI_GATEWAY_URL:?AI_GATEWAY_URL is required for AI smoke verification}"
  : "${AI_GATEWAY_KEY:?AI_GATEWAY_KEY is required for AI smoke verification}"
  : "${TENANT_ID:?TENANT_ID is required for AI smoke verification}"
  echo "[staging-gate] AI gateway smoke"
  npm run ops:ai-smoke
else
  echo "[staging-gate] AI gateway smoke skipped (AI_GATEWAY_URL / AI_GATEWAY_KEY not set)"
fi

if [[ -n "${APP_BASE_URL:-}" || -n "${NEXTAUTH_URL:-}" || -n "${PLAYWRIGHT_BASE_URL:-}" ]]; then
  echo "[staging-gate] Post-deploy smoke"
  npm run ops:post-deploy-smoke
else
  echo "[staging-gate] Post-deploy smoke skipped (APP_BASE_URL / NEXTAUTH_URL / PLAYWRIGHT_BASE_URL not set)"
fi

if [[ "$RUN_IMPORT_VERIFY" -eq 1 ]]; then
  : "${TENANT_ID:?TENANT_ID is required for import verification}"
  : "${IMPORT_BATCH_ID:?IMPORT_BATCH_ID is required for import verification}"
  echo "[staging-gate] Import verification for batch ${IMPORT_BATCH_ID}"
  npm run ops:import-rehearsal -- --mode verify-import --tenant-id "$TENANT_ID" --batch-id "$IMPORT_BATCH_ID"
fi

if [[ "$RUN_ROLLBACK_VERIFY" -eq 1 ]]; then
  : "${TENANT_ID:?TENANT_ID is required for rollback verification}"
  : "${ROLLBACK_BATCH_ID:?ROLLBACK_BATCH_ID is required for rollback verification}"
  echo "[staging-gate] Rollback verification for batch ${ROLLBACK_BATCH_ID}"
  npm run ops:import-rehearsal -- --mode verify-rollback --tenant-id "$TENANT_ID" --batch-id "$ROLLBACK_BATCH_ID"
fi

echo "[staging-gate] OK"
