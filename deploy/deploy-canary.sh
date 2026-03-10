#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Canary deployment for Cloud Run
# Deploys a new revision with no traffic, health-checks it, then shifts traffic.
# ---------------------------------------------------------------------------

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="europe-central2"
SERVICE="primaria"
REPO="primaria"
IMAGE="europe-central2-docker.pkg.dev/$PROJECT_ID/$REPO/app"

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
TAG="${1:-$GIT_SHA}"

echo "==> Building Docker image (tag: $TAG)..."
docker build -t "$IMAGE:$TAG" -t "$IMAGE:latest" .

echo "==> Pushing to Artifact Registry..."
docker push "$IMAGE:$TAG"
docker push "$IMAGE:latest"

# ---------------------------------------------------------------------------
# Run database migrations before deploying the new revision
# ---------------------------------------------------------------------------
echo "==> Running database migrations..."
DIRECT_DB_URL=$(gcloud secrets versions access latest \
  --secret="primaria-direct-database-url" \
  --project="$PROJECT_ID" 2>/dev/null || true)

if [ -n "$DIRECT_DB_URL" ]; then
  docker run --rm \
    -e DATABASE_URL="$DIRECT_DB_URL" \
    "$IMAGE:$TAG" \
    npx prisma migrate deploy
  echo "    Migrations applied."
else
  echo "    WARNING: Could not fetch DIRECT_DATABASE_URL secret. Skipping migrations."
fi

echo "==> Deploying new revision with --no-traffic..."
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --image "$IMAGE:$TAG" \
  --region "$REGION" \
  --platform managed \
  --no-traffic \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --no-cpu-throttling \
  --cpu-boost \
  --set-env-vars "NODE_ENV=production,TENANT_ID=${TENANT_ID:?Set TENANT_ID},NEXTAUTH_URL=${NEXTAUTH_URL:?Set NEXTAUTH_URL},AUTH_TRUST_HOST=true" \
  --set-secrets "\
DATABASE_URL=primaria-database-url:latest,\
DIRECT_DATABASE_URL=primaria-direct-database-url:latest,\
NEXTAUTH_SECRET=primaria-nextauth-secret:latest,\
JWT_SECRET=primaria-jwt-secret:latest,\
CNP_ENCRYPTION_KEY=primaria-cnp-encryption-key:latest,\
CNP_TENANT_SALT_SECRET=primaria-cnp-tenant-salt:latest,\
REDIS_URL=primaria-redis-url:latest,\
STRIPE_SECRET_KEY=primaria-stripe-key:latest,\
STRIPE_WEBHOOK_SECRET=primaria-stripe-webhook:latest,\
AI_GATEWAY_URL=primaria-ai-gateway-url:latest,\
AI_GATEWAY_KEY=primaria-ai-gateway-key:latest"

# Get the canary revision URL
CANARY_REV=$(gcloud run revisions list \
  --service "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --sort-by "~creationTimestamp" \
  --limit 1 \
  --format "value(metadata.name)")

CANARY_URL=$(gcloud run revisions describe "$CANARY_REV" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format "value(status.url)" 2>/dev/null || true)

if [ -z "$CANARY_URL" ]; then
  # Fallback: construct URL from service URL with revision tag
  SERVICE_URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
  CANARY_URL="${SERVICE_URL//$SERVICE/$CANARY_REV}"
fi

echo "==> Health-checking canary revision: $CANARY_REV"
echo "    URL: $CANARY_URL"

HEALTH_OK=false
for i in 1 2 3 4 5; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CANARY_URL/api/health" --max-time 10 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    HEALTH_OK=true
    echo "    Health check passed (attempt $i)"
    break
  fi
  echo "    Health check failed (HTTP $HTTP_CODE, attempt $i/5), retrying in 10s..."
  sleep 10
done

if [ "$HEALTH_OK" != "true" ]; then
  echo "ERROR: Canary health check failed after 5 attempts. Aborting."
  echo "       The new revision has 0% traffic. Investigate and re-run, or run rollback.sh."
  exit 1
fi

echo "==> Shifting 10% traffic to canary..."
gcloud run services update-traffic "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --to-revisions "$CANARY_REV=10"

echo "==> Waiting 60s for canary soak..."
sleep 60

echo "==> Shifting 100% traffic to canary..."
gcloud run services update-traffic "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --to-revisions "$CANARY_REV=100"

echo "==> Canary deployment complete!"
echo "    Revision: $CANARY_REV"
echo "    Git SHA: $GIT_SHA"
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)'
