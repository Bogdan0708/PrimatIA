#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="europe-central2"
SERVICE="primaria"
REPO="primaria"
IMAGE="europe-central2-docker.pkg.dev/$PROJECT_ID/$REPO/app"

echo "🏗️  Building Docker image..."
docker build -t "$IMAGE:latest" .

echo "📤 Pushing to Artifact Registry..."
docker push "$IMAGE:latest"

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --image "$IMAGE:latest" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --cpu-throttling \
  --cpu-boost \
  --set-env-vars "NODE_ENV=production,TENANT_ID=${TENANT_ID:?Set TENANT_ID},NEXTAUTH_URL=${NEXTAUTH_URL:?Set NEXTAUTH_URL},AUTH_TRUST_HOST=true" \
  --set-secrets "DATABASE_URL=primaria-database-url:latest,DIRECT_DATABASE_URL=primaria-direct-database-url:latest,NEXTAUTH_SECRET=primaria-nextauth-secret:latest,STRIPE_SECRET_KEY=primaria-stripe-key:latest,STRIPE_WEBHOOK_SECRET=primaria-stripe-webhook:latest,AI_GATEWAY_URL=primaria-ai-gateway-url:latest,AI_GATEWAY_KEY=primaria-ai-gateway-key:latest"

echo "✅ Deployed! URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)'
