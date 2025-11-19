#!/bin/bash
echo "🔍 MAGI-AC データ確認"
echo "====================="
echo ""

# BigQuery
echo "1️⃣ BigQueryデータ件数:"
bq query --use_legacy_sql=false --location=asia-northeast1 --format=csv \
  'SELECT COUNT(*) as total FROM `screen-share-459802.magi_ac.financials_raw`' | tail -1

echo ""
echo "2️⃣ BigQuery最新5件:"
bq query --use_legacy_sql=false --location=asia-northeast1 --format=pretty \
  'SELECT symbol, company, timestamp FROM `screen-share-459802.magi_ac.financials_raw` ORDER BY timestamp DESC LIMIT 5'

echo ""
echo "3️⃣ Cloud Storageファイル数:"
gsutil ls gs://magi-ac-data/raw/financials/**/*.json 2>/dev/null | wc -l

echo ""
echo "4️⃣ Cloud Storage最新ファイル:"
gsutil ls -lh gs://magi-ac-data/raw/financials/2025/11/ 2>/dev/null | tail -5

echo ""
echo "5️⃣ サービスアカウント:"
gcloud run services describe magi-ac --region=asia-northeast1 \
  --format='value(spec.template.spec.serviceAccountName)'

echo ""
echo "✅ データ確認完了"
