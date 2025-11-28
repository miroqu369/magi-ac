#!/bin/bash
# AI株価予測機能のテストスクリプト

set -e

API_URL="http://localhost:8888"
SYMBOL="AAPL"

echo "========================================="
echo "MAGI AC - AI Stock Prediction Test"
echo "========================================="
echo ""

# サーバー起動確認
echo "[1/7] Checking server health..."
curl -s "${API_URL}/health" | jq '.'
echo ""

# 予測テーブル初期化
echo "[2/7] Initializing predictions table..."
curl -s -X POST "${API_URL}/api/admin/init-predictions-table" | jq '.'
echo ""

# 1日後予測（モックモード）
echo "[3/7] Testing 1-day prediction (mock mode)..."
curl -s -X POST "${API_URL}/api/predict" \
  -H "Content-Type: application/json" \
  -d "{
    \"symbol\": \"${SYMBOL}\",
    \"horizon\": \"1day\",
    \"enableAI\": false
  }" | jq '.'
echo ""

sleep 2

# 1週間後予測（モックモード）
echo "[4/7] Testing 1-week prediction (mock mode)..."
curl -s -X POST "${API_URL}/api/predict" \
  -H "Content-Type: application/json" \
  -d "{
    \"symbol\": \"${SYMBOL}\",
    \"horizon\": \"1week\",
    \"enableAI\": false
  }" | jq '.'
echo ""

sleep 2

# 3ヶ月後予測（モックモード）
echo "[5/7] Testing 3-months prediction (mock mode)..."
curl -s -X POST "${API_URL}/api/predict" \
  -H "Content-Type: application/json" \
  -d "{
    \"symbol\": \"${SYMBOL}\",
    \"horizon\": \"3months\",
    \"enableAI\": false
  }" | jq '.'
echo ""

sleep 2

# バッチ予測
echo "[6/7] Testing batch prediction..."
curl -s -X POST "${API_URL}/api/predict/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "TSLA", "NVDA"],
    "horizon": "1month",
    "enableAI": false
  }' | jq '.'
echo ""

sleep 2

# 予測履歴取得
echo "[7/7] Testing prediction history..."
curl -s "${API_URL}/api/predict/history/${SYMBOL}?days=7" | jq '.'
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Set AI API keys in .env file"
echo "2. Test with enableAI=true for real AI predictions"
echo "3. Try different horizons: 1day, 1week, 1month, 3months, 2years"
echo ""
echo "Example with AI enabled:"
echo "curl -X POST ${API_URL}/api/predict \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"symbol\":\"AAPL\",\"horizon\":\"3months\",\"enableAI\":true}'"
echo ""
