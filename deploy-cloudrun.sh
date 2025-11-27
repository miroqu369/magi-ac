#!/bin/bash
# MAGI AC - Cloud Run デプロイスクリプト
# Project: screen-share-459802

set -e  # エラーで停止

echo "========================================="
echo "  MAGI AC Cloud Run Deployment"
echo "  Project: screen-share-459802"
echo "========================================="
echo ""

# 環境変数設定
export PROJECT_ID="screen-share-459802"
export REGION="asia-northeast1"
export SERVICE_NAME="magi-ac"

# Step 1: プロジェクト設定
echo "Step 1: Setting up GCP project..."
gcloud config set project ${PROJECT_ID}

# Step 2: 必要なAPI有効化
echo ""
echo "Step 2: Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  bigquery.googleapis.com \
  secretmanager.googleapis.com

# Step 3: サービスアカウント作成
echo ""
echo "Step 3: Creating service account..."
if gcloud iam service-accounts describe ${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com 2>/dev/null; then
  echo "Service account already exists, skipping..."
else
  gcloud iam service-accounts create ${SERVICE_NAME}-sa \
    --display-name="MAGI AC Service Account"
fi

# Step 4: BigQuery権限付与
echo ""
echo "Step 4: Granting BigQuery permissions..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor" \
  --condition=None

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser" \
  --condition=None

# Step 5: Dockerビルド & プッシュ
echo ""
echo "Step 5: Building and pushing Docker image..."
gcloud builds submit \
  --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --timeout=20m

# Step 6: Cloud Run デプロイ
echo ""
echo "Step 6: Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --service-account ${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,PORT=8080,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"

# Step 7: サービスURL取得
echo ""
echo "Step 7: Getting service URL..."
export SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format 'value(status.url)')

echo ""
echo "========================================="
echo "  Deployment Complete!"
echo "========================================="
echo ""
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Test commands:"
echo ""
echo "# Health check"
echo "curl ${SERVICE_URL}/health"
echo ""
echo "# Basic analysis"
echo "curl -X POST ${SERVICE_URL}/api/institutional/analyze \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"symbol\":\"AAPL\",\"enableAI\":false,\"saveToDB\":false}'"
echo ""
echo "# Initialize BigQuery tables"
echo "curl -X POST ${SERVICE_URL}/api/admin/init-iaa-tables"
echo ""
