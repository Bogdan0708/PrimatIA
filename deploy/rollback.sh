#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Rollback to the previous Cloud Run revision
# ---------------------------------------------------------------------------

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="europe-central2"
SERVICE="primaria"
DRY_RUN="${1:-}"

echo "==> Listing recent revisions for $SERVICE..."
REVISIONS=$(gcloud run revisions list \
  --service "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --sort-by "~creationTimestamp" \
  --limit 5 \
  --format "table(metadata.name, status.conditions[0].status, spec.containers[0].image, metadata.creationTimestamp)")

echo "$REVISIONS"
echo ""

# Get current serving revision
CURRENT_REV=$(gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format "value(status.traffic[0].revisionName)")

# Get previous revision (second most recent)
PREVIOUS_REV=$(gcloud run revisions list \
  --service "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --sort-by "~creationTimestamp" \
  --limit 2 \
  --format "value(metadata.name)" | tail -1)

if [ -z "$PREVIOUS_REV" ]; then
  echo "ERROR: No previous revision found to roll back to."
  exit 1
fi

echo "Current revision:  $CURRENT_REV"
echo "Rollback target:   $PREVIOUS_REV"
echo ""

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "[DRY RUN] Would route 100% traffic to $PREVIOUS_REV"
  echo ""
  echo "WARNING: If you applied database migrations in the current revision,"
  echo "         they are NOT automatically rolled back. You must manually run:"
  echo "         npx prisma migrate resolve --rolled-back <migration_name>"
  exit 0
fi

echo "==> Routing 100% traffic to $PREVIOUS_REV..."
gcloud run services update-traffic "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --to-revisions "$PREVIOUS_REV=100"

echo ""
echo "==> Rollback complete!"
echo "    All traffic now routed to: $PREVIOUS_REV"
echo ""
echo "WARNING: If the current deployment included database migrations,"
echo "         they are NOT automatically rolled back. Check if you need to:"
echo "         1. Verify the old revision works with the new schema"
echo "         2. Or manually revert the migration:"
echo "            npx prisma migrate resolve --rolled-back <migration_name>"
