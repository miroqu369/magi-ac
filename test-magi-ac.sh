#!/bin/bash
set -e

URL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(status.url)')
TOKEN=$(gcloud auth print-identity-token)

echo "🌐 URL: $URL"
echo "🔑 認証トークン取得完了"
echo ""

echo "=== 1. ヘルスチェック ==="
curl -s -H "Authorization: Bearer $TOKEN" "$URL/health" | jq .
echo ""

echo "=== 2. 分析実行: AAPL ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$URL/api/analyze" \
  -d '{"symbol":"AAPL"}' | jq '{ symbol, company, timestamp, analysis: (.analysis[:200] + "...") }'
echo ""

echo "=== 3. 分析実行: NVDA ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST "$URL/api/analyze" \
  -d '{"symbol":"NVDA"}' | jq '{ symbol, company, timestamp, analysis: (.analysis[:200] + "...") }'
echo ""

echo "=== 4. BigQuery確認 ==="
bq query --use_legacy_sql=false --location=asia-northeast1 --format=pretty \
  'SELECT symbol, company, CAST(timestamp AS STRING) as time FROM `screen-share-459802.magi_ac.financials_raw` ORDER BY timestamp DESC LIMIT 5'
echo ""

echo "=== 5. 最新データ取得: AAPL ==="
curl -s -H "Authorization: Bearer $TOKEN" "$URL/api/analytics/latest/AAPL" | jq .
echo ""

echo "✅ すべてのテスト完了"
echo ""
echo "📊 BigQuery Console: https://console.cloud.google.com/bigquery?project=screen-share-459802"
echo "🌐 Web UI（Cloud Shellから）: $URL"
