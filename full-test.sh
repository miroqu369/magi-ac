#!/bin/bash
set -e

echo "🚀 MAGI-AC 完全動作確認"
echo "=========================="
echo ""

# URLとトークン取得
URL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(status.url)')
TOKEN=$(gcloud auth print-identity-token)

echo "📍 URL: $URL"
echo ""

# 1. ヘルスチェック
echo "1️⃣ ヘルスチェック"
curl -s -H "Authorization: Bearer $TOKEN" "$URL/health" | jq '.status, .components'
echo ""

# 2. 分析実行（複数）
for SYMBOL in AAPL GOOGL MSFT NVDA; do
  echo "2️⃣ 分析: $SYMBOL"
  curl -s -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "$URL/api/analyze" \
    -d "{\"symbol\":\"$SYMBOL\"}" | jq '{ symbol, company, price: .financialData.currentPrice }'
  sleep 1
done
echo ""

# 3. BigQueryから最新データ取得
echo "3️⃣ BigQueryから最新データ取得"
bq query --use_legacy_sql=false --location=asia-northeast1 --format=pretty \
  'SELECT symbol, company, CAST(timestamp AS STRING) as time 
   FROM `screen-share-459802.magi_ac.financials_raw` 
   ORDER BY timestamp DESC 
   LIMIT 10'
echo ""

# 4. API経由でBigQueryデータ取得
echo "4️⃣ API経由で履歴取得: AAPL"
curl -s -H "Authorization: Bearer $TOKEN" \
  "$URL/api/analytics/latest/AAPL" | jq '{ symbol, company, timestamp }'
echo ""

# 5. 統計情報
echo "5️⃣ シンボル別統計"
bq query --use_legacy_sql=false --location=asia-northeast1 --format=pretty \
  'SELECT symbol, COUNT(*) as count, MAX(timestamp) as latest 
   FROM `screen-share-459802.magi_ac.financials_raw` 
   GROUP BY symbol 
   ORDER BY count DESC'
echo ""

echo "✅ 完全動作確認完了"
echo ""
echo "📊 BigQuery Console: https://console.cloud.google.com/bigquery?project=screen-share-459802"
echo "☁️ Cloud Storage: https://console.cloud.google.com/storage/browser/magi-ac-data"
echo "🌐 Web UI: $URL (認証必要)"
