#!/bin/bash
set -e

echo "🔧 MAGI-AC 完全修正スクリプト"
echo "=============================="
echo ""

# サービスアカウント取得
SA_EMAIL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(spec.template.spec.serviceAccountName)')
if [ -z "$SA_EMAIL" ] || [ "$SA_EMAIL" == "None" ]; then
  SA_EMAIL="398890937507-compute@developer.gserviceaccount.com"
fi

echo "📌 サービスアカウント: $SA_EMAIL"
echo ""

# 権限付与
echo "🔑 権限付与中..."
gcloud projects add-iam-policy-binding screen-share-459802 \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.dataEditor" \
  --condition=None --quiet 2>/dev/null || true

gcloud projects add-iam-policy-binding screen-share-459802 \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" \
  --condition=None --quiet 2>/dev/null || true

gcloud projects add-iam-policy-binding screen-share-459802 \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.user" \
  --condition=None --quiet 2>/dev/null || true

gcloud projects add-iam-policy-binding screen-share-459802 \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --condition=None --quiet 2>/dev/null || true

echo "✅ 権限付与完了"
echo ""

# サービス更新
echo "🔄 サービス更新中..."
gcloud run services update magi-ac \
  --region=asia-northeast1 \
  --service-account="${SA_EMAIL}" \
  --quiet

echo "✅ サービス更新完了"
echo ""

# テスト実行
echo "🧪 テスト実行中..."
URL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(status.url)')
TOKEN=$(gcloud auth print-identity-token)

echo "分析実行: TSLA"
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$URL/api/analyze" \
  -d '{"symbol":"TSLA"}' | jq '{ symbol, company, price: .financialData.currentPrice }'

echo ""
echo "⏳ 5秒待機..."
sleep 5

# ログ確認
echo ""
echo "📋 最新ログ:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=magi-ac" \
  --limit=5 \
  --format="value(textPayload)" \
  --order=desc | head -10

# データ確認
echo ""
echo "📊 BigQueryデータ確認:"
bq query --use_legacy_sql=false --location=asia-northeast1 --format=pretty \
  'SELECT symbol, company, timestamp FROM `screen-share-459802.magi_ac.financials_raw` ORDER BY timestamp DESC LIMIT 5'

echo ""
echo "💾 Cloud Storageファイル確認:"
gsutil ls gs://magi-ac-data/raw/financials/2025/11/ | tail -5

echo ""
echo "✅ すべて完了"
echo ""
echo "📊 BigQuery Console: https://console.cloud.google.com/bigquery?project=screen-share-459802"
echo "☁️ Cloud Storage: https://console.cloud.google.com/storage/browser/magi-ac-data"
echo "🌐 Web UI: $URL"
