#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="europe-central2"

echo "📦 Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  redis.googleapis.com

echo "🗄️ Creating Artifact Registry..."
gcloud artifacts repositories create primaria \
  --repository-format=docker \
  --location=$REGION

echo "🐘 Creating Cloud SQL (PostgreSQL)..."
gcloud sql instances create primaria-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-size=10GB \
  --storage-type=SSD \
  --availability-type=zonal \
  --edition=ENTERPRISE

gcloud sql databases create primaria --instance=primaria-db
gcloud sql users set-password postgres --instance=primaria-db --password="$(openssl rand -base64 24)"

echo "🔴 Creating Memorystore Redis..."
gcloud redis instances create primaria-cache \
  --size=1 \
  --region=$REGION \
  --tier=basic \
  --redis-version=redis_7_0

echo "🔐 Creating secrets..."
gcloud secrets create primaria-database-url --replication-policy=automatic
gcloud secrets create primaria-direct-database-url --replication-policy=automatic
gcloud secrets create primaria-nextauth-secret --replication-policy=automatic
gcloud secrets create primaria-stripe-key --replication-policy=automatic
gcloud secrets create primaria-stripe-webhook --replication-policy=automatic
gcloud secrets create primaria-ai-gateway-url --replication-policy=automatic
gcloud secrets create primaria-ai-gateway-key --replication-policy=automatic

echo "✅ GCP infrastructure ready!"
echo "Next steps:"
echo "1. Set secret values: gcloud secrets versions add primaria-database-url --data-file=-"
echo "2. Configure Cloud SQL connection in Cloud Run"
echo "3. Run: ./deploy/deploy.sh"
