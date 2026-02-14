# PrimărIA — GCP Cloud Run Deployment

## Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud` CLI)
- [Docker](https://docs.docker.com/get-docker/)
- GCP project with billing enabled
- `GCP_PROJECT_ID` environment variable set

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| Cloud Run (0-3 instances) | £5-15 |
| Cloud SQL (db-f1-micro) | £8-12 |
| Memorystore Redis (1GB basic) | £10-15 |
| Artifact Registry | £1-2 |
| Secret Manager | <£1 |
| **Total** | **£20-50/month** |

*Costs depend on traffic. Cloud Run scales to zero when idle.*

## Step-by-Step Deployment

### 1. One-Time GCP Setup

```bash
export GCP_PROJECT_ID=your-project-id
chmod +x deploy/gcp-setup.sh
./deploy/gcp-setup.sh
```

### 2. Set Secrets

```bash
# Database URL (get connection string from Cloud SQL)
echo -n "postgresql://postgres:PASSWORD@/primaria?host=/cloudsql/$GCP_PROJECT_ID:europe-central2:primaria-db" | \
  gcloud secrets versions add primaria-database-url --data-file=-

# NextAuth secret
openssl rand -base64 32 | gcloud secrets versions add primaria-nextauth-secret --data-file=-

# Stripe keys
echo -n "sk_live_..." | gcloud secrets versions add primaria-stripe-key --data-file=-
echo -n "whsec_..." | gcloud secrets versions add primaria-stripe-webhook --data-file=-

# LM Studio URL (or empty if not used)
echo -n "" | gcloud secrets versions add primaria-lm-studio-url --data-file=-
```

### 3. Connect Cloud SQL

Grant the Cloud Run service account access to Cloud SQL:

```bash
SA="$(gcloud iam service-accounts list --filter='displayName:Compute Engine' --format='value(email)')"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"
```

Add `--add-cloudsql-instances=$GCP_PROJECT_ID:europe-central2:primaria-db` to the deploy command, or update `deploy/deploy.sh`.

### 4. Deploy

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### 5. Run Database Migrations

```bash
# Connect via Cloud SQL Auth Proxy locally
cloud-sql-proxy $GCP_PROJECT_ID:europe-central2:primaria-db &
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/primaria" npx prisma migrate deploy
```

## Monitoring & Logs

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=primaria" --limit=50

# Stream logs
gcloud beta run services logs tail primaria --region=europe-central2

# View metrics in console
open "https://console.cloud.google.com/run/detail/europe-central2/primaria/metrics?project=$GCP_PROJECT_ID"
```

## Custom Domain

```bash
# Map domain
gcloud beta run domain-mappings create \
  --service=primaria \
  --domain=app.primaria.ro \
  --region=europe-central2

# Get DNS records to configure
gcloud beta run domain-mappings describe \
  --domain=app.primaria.ro \
  --region=europe-central2
```

## CI/CD with Cloud Build

Connect your GitHub repo to Cloud Build, then it will use `deploy/cloudbuild.yaml` automatically on push.

```bash
gcloud builds triggers create github \
  --repo-name=primaria \
  --repo-owner=YOUR_GITHUB_USER \
  --branch-pattern="^main$" \
  --build-config=deploy/cloudbuild.yaml
```
