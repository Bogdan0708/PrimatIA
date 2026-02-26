#!/usr/bin/env bash
# PrimărIA — Live Health & AI Integration Diagnostics
# Pulls the last 24 hours of errors and summarizes service health.

set -euo pipefail

PROJECT_ID="mitch-ai-services"
REGION_APP="europe-central2"
REGION_GW="europe-west2"

echo "🔍 Running PrimărIA Live Diagnostics..."
echo "--------------------------------------------------"

# 1. Check Service Status
echo "📡 Service Status:"
gcloud run services list --project "$PROJECT_ID" --format="table(NAME,REGION,URL,LAST_DEPLOYED_AT)" | grep -E "NAME|primaria|ai-gateway"
echo ""

# 2. Check PrimărIA App Errors (Last 24h)
echo "❌ App Errors (Last 24h):"
TIMESTAMP=$(date -u -d '24 hours ago' '+%Y-%m-%dT%H:%M:%SZ')
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=primaria AND severity>=ERROR AND timestamp>=\"$TIMESTAMP\"" --project "$PROJECT_ID" --format="table(timestamp, textPayload)" --limit=10
echo ""

# 3. Check AI Gateway Health
echo "🤖 AI Gateway Integration:"
GW_URL=$(gcloud secrets versions access latest --secret primaria-ai-gateway-url --project "$PROJECT_ID")
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$GW_URL/health")

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ AI Gateway is REACHABLE (HTTP 200)"
else
  echo "⚠️ AI Gateway Health Check FAILED (HTTP $HTTP_STATUS)"
fi
echo ""

# 4. Check AI Gateway Errors (Last 24h)
echo "❌ AI Gateway Errors (Last 24h):"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ai-gateway AND severity>=ERROR AND timestamp>=\"$TIMESTAMP\"" --project "$PROJECT_ID" --format="table(timestamp, textPayload)" --limit=10
echo ""

echo "--------------------------------------------------"
echo "✅ Diagnostics Complete."
