#!/usr/bin/env bash
set -euo pipefail

STRICT=0
NO_DB=0

for arg in "$@"; do
  case "$arg" in
    --strict)
      STRICT=1
      ;;
    --no-db)
      NO_DB=1
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--strict] [--no-db]"
      exit 1
      ;;
  esac
done

echo "[preflight] Prisma schema validation"
npx prisma validate

echo "[preflight] Prisma client generation"
npx prisma generate >/dev/null

if [[ "$NO_DB" -eq 1 ]]; then
  echo "[preflight] Skipping DB connectivity checks (--no-db)"
  exit 0
fi

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${DIRECT_DATABASE_URL:?DIRECT_DATABASE_URL must be set}"

echo "[preflight] Migration status"
npx prisma migrate status

if [[ -n "${SHADOW_DATABASE_URL:-}" ]]; then
  echo "[preflight] Drift check (migrations vs schema)"
  npx prisma migrate diff \
    --from-migrations prisma/migrations \
    --to-schema-datamodel prisma/schema.prisma \
    --shadow-database-url "$SHADOW_DATABASE_URL" \
    --exit-code
elif [[ "$STRICT" -eq 1 ]]; then
  echo "[preflight] Strict mode requires SHADOW_DATABASE_URL for drift detection"
  exit 1
else
  echo "[preflight] SHADOW_DATABASE_URL not set; skipping drift check"
fi

echo "[preflight] OK"
