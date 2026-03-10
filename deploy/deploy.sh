#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="europe-central2"
SERVICE="primaria"
REPO="primaria"
IMAGE="europe-central2-docker.pkg.dev/$PROJECT_ID/$REPO/app"

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "🏗️  Building Docker image (SHA: $GIT_SHA)..."
docker build -t "$IMAGE:latest" -t "$IMAGE:$GIT_SHA" .

echo "📤 Pushing to Artifact Registry..."
docker push "$IMAGE:latest"
docker push "$IMAGE:$GIT_SHA"

# ---------------------------------------------------------------------------
# Run database migrations before deploying the new revision
# Uses the DIRECT_DATABASE_URL (bypasses PgBouncer) for DDL operations
# ---------------------------------------------------------------------------
echo "🗄️  Running database migrations..."
DIRECT_DB_URL=$(gcloud secrets versions access latest \
  --secret="primaria-direct-database-url" \
  --project="$PROJECT_ID" 2>/dev/null || true)

if [ -n "$DIRECT_DB_URL" ]; then
  docker run --rm -e DIRECT_DATABASE_URL="$DIRECT_DB_URL" \
    -e DATABASE_URL="$DIRECT_DB_URL" \
    "$IMAGE:$GIT_SHA" \
    npx prisma migrate deploy
  echo "✅ Migrations applied."
else
  echo "⚠️  Could not fetch DIRECT_DATABASE_URL secret. Skipping migrations."
  echo "   Ensure 'primaria-direct-database-url' exists in Secret Manager."
fi

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --image "$IMAGE:$GIT_SHA" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
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

echo "✅ Deployed revision $GIT_SHA!"
echo "   URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)'
