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
  redis.googleapis.com \
  vpcaccess.googleapis.com \
  cloudresourcemanager.googleapis.com

# Get project number for IAM bindings
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "🔐 Granting Secret Manager Access to Service Account: $SERVICE_ACCOUNT"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

echo "🗄️ Creating Artifact Registry..."
gcloud artifacts repositories create primaria \
  --repository-format=docker \
  --location=$REGION \
  2>/dev/null || echo "   (already exists)"

echo "🐘 Creating Cloud SQL (PostgreSQL) in $REGION..."
gcloud sql instances create primaria-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-1-3840 \
  --region=$REGION \
  --storage-size=10GB \
  --storage-type=SSD \
  --availability-type=zonal \
  --edition=ENTERPRISE \
  2>/dev/null || echo "   (already exists)"

gcloud sql databases create primaria --instance=primaria-db 2>/dev/null || echo "   (database already exists)"

DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users set-password postgres --instance=primaria-db --password="$DB_PASSWORD"
echo "   Database password set (save it securely)."

echo "🔴 Creating Memorystore Redis in $REGION..."
gcloud redis instances create primaria-cache \
  --size=1 \
  --region=$REGION \
  --tier=basic \
  --redis-version=redis_7_0 \
  2>/dev/null || echo "   (already exists)"

echo "🌐 Creating VPC connector for Cloud Run..."
gcloud compute networks vpc-access connectors create primaria-vpc \
  --region=$REGION \
  --range="10.8.0.0/28" \
  2>/dev/null || echo "   (already exists)"

echo "🔐 Creating secrets..."
SECRETS=(
  primaria-database-url
  primaria-direct-database-url
  primaria-nextauth-secret
  primaria-jwt-secret
  primaria-cnp-encryption-key
  primaria-cnp-tenant-salt
  primaria-redis-url
  primaria-stripe-key
  primaria-stripe-webhook
  primaria-ai-gateway-url
  primaria-ai-gateway-key
)

for secret in "${SECRETS[@]}"; do
  gcloud secrets create "$secret" --replication-policy=automatic 2>/dev/null \
    || echo "   $secret already exists"
done

echo ""
echo "✅ GCP infrastructure ready!"
echo ""
echo "Next steps:"
echo "1. Set secret values:"
echo "   echo -n 'value' | gcloud secrets versions add SECRET_NAME --data-file=-"
echo ""
echo "   Required secrets:"
for secret in "${SECRETS[@]}"; do
  echo "   - $secret"
done
echo ""
echo "2. Get Redis host for REDIS_URL secret:"
echo "   gcloud redis instances describe primaria-cache --region=$REGION --format='value(host)'"
echo ""
echo "3. Deploy: TENANT_ID=xxx NEXTAUTH_URL=https://... ./deploy/deploy.sh"
