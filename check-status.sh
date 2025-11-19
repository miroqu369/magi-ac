#!/bin/bash

echo "🔍 MAGI-AC システム総合チェック"
echo "================================"
echo ""

# 1. Cloud Runサービス状態
echo "1️⃣ Cloud Runサービス"
echo "----------------------------"
gcloud run services describe magi-ac --region=asia-northeast1 --format="value(status.url,status.conditions.status)" 2>/dev/null && echo "✅ サービス稼働中" || echo "❌ サービスが見つかりません"
URL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(status.url)' 2>/dev/null)
echo "URL: $URL"
echo ""

# 2. サービスアカウント
echo "2️⃣ サービスアカウント"
echo "----------------------------"
SA_EMAIL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null)
echo "サービスアカウント: ${SA_EMAIL:-未設定}"
echo ""

# 3. サービスアカウント権限
echo "3️⃣ サービスアカウント権限"
echo "----------------------------"
if [ -n "$SA_EMAIL" ] && [ "$SA_EMAIL" != "None" ]; then
  gcloud projects get-iam-policy screen-share-459802 \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:${SA_EMAIL}" \
    --format="table(bindings.role)" 2>/dev/null | grep -E "bigquery|storage" || echo "⚠️ BigQuery/Storage権限なし"
else
  echo "⚠️ サービスアカウント未設定"
fi
echo ""

# 4. 認証テスト
echo "4️⃣ 認証テスト"
echo "----------------------------"
TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
if [ -n "$TOKEN" ]; then
  echo "✅ 認証トークン取得成功"
  HEALTH=$(curl -s -H "Authorization: Bearer $TOKEN" "$URL/health" 2>/dev/null)
  if echo "$HEALTH" | jq -e '.status' >/dev/null 2>&1; then
    echo "✅ ヘルスチェック成功"
    echo "$HEALTH" | jq '{ status, version, components }'
  else
    echo "❌ ヘルスチェック失敗"
  fi
else
  echo "❌ 認証トークン取得失敗"
fi
echo ""

# 5. BigQueryテーブル
echo "5️⃣ BigQueryテーブル"
echo "----------------------------"
TABLE_EXISTS=$(bq show screen-share-459802:magi_ac.financials_raw 2>/dev/null && echo "yes" || echo "no")
if [ "$TABLE_EXISTS" = "yes" ]; then
  echo "✅ テーブル存在"
  ROW_COUNT=$(bq query --use_legacy_sql=false --location=asia-northeast1 --format=csv 'SELECT COUNT(*) FROM `screen-share-459802.magi_ac.financials_raw`' 2>/dev/null | tail -1)
  echo "データ件数: ${ROW_COUNT:-0} 件"
else
  echo "❌ テーブルが見つかりません"
fi
echo ""

# 6. Cloud Storage
echo "6️⃣ Cloud Storage"
echo "----------------------------"
FILE_COUNT=$(gsutil ls -r gs://magi-ac-data/raw/financials/ 2>/dev/null | grep -c ".json" || echo "0")
echo "保存ファイル数: $FILE_COUNT 件"
if [ "$FILE_COUNT" -gt 0 ]; then
  echo "最新ファイル:"
  gsutil ls -lh gs://magi-ac-data/raw/financials/2025/11/ 2>/dev/null | tail -3 || echo "ファイルなし"
fi
echo ""

# 7. 最新ログ
echo "7️⃣ 最新ログ（5件）"
echo "----------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=magi-ac" \
  --limit=5 \
  --format="value(timestamp,severity,textPayload)" \
  --order=desc 2>/dev/null | head -10 || echo "ログなし"
echo ""

# 8. APIテスト
echo "8️⃣ APIテスト"
echo "----------------------------"
if [ -n "$TOKEN" ] && [ -n "$URL" ]; then
  TEST_RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "$URL/api/analyze" \
    -d '{"symbol":"TEST"}' 2>/dev/null)
  
  if echo "$TEST_RESULT" | jq -e '.symbol' >/dev/null 2>&1; then
    echo "✅ API動作確認"
    echo "$TEST_RESULT" | jq '{ symbol, company, price: .financialData.currentPrice }'
  else
    echo "❌ API失敗"
  fi
else
  echo "⏭️ スキップ（認証情報なし）"
fi
echo ""

# 9. サマリー
echo "📊 チェックサマリー"
echo "================================"
echo "Cloud Run: $([ -n "$URL" ] && echo '✅' || echo '❌')"
echo "認証: $([ -n "$TOKEN" ] && echo '✅' || echo '❌')"
echo "BigQuery: $( [ "$TABLE_EXISTS" = "yes" ] && echo '✅' || echo '❌')"
echo "Storage: $([ "$FILE_COUNT" -gt 0 ] && echo "✅ ($FILE_COUNT files)" || echo '⚠️')"
echo ""
echo "🌐 Web UI: $URL"
echo "📊 BigQuery: https://console.cloud.google.com/bigquery?project=screen-share-459802"
echo "☁️ Storage: https://console.cloud.google.com/storage/browser/magi-ac-data"
echo ""
