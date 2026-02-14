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
  --startup-cpu-boost \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=primaria-database-url:latest,NEXTAUTH_SECRET=primaria-nextauth-secret:latest,STRIPE_SECRET_KEY=primaria-stripe-key:latest,STRIPE_WEBHOOK_SECRET=primaria-stripe-webhook:latest,LM_STUDIO_URL=primaria-lm-studio-url:latest"

echo "✅ Deployed! URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)'
