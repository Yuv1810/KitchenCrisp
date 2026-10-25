#!/bin/bash
# Simple 1-command deployment to Google Cloud Run
echo "🚀 Deploying Kitchen Crisp to Google Cloud..."

gcloud run deploy kitchen-crisp \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --port 8080
