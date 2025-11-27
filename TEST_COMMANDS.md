# IAA システム - テストコマンド集

## 環境変数設定

```bash
export BASE_URL="http://localhost:8888"
```

---

## Phase 1: 基盤機能テスト

### 1. 基本分析 (AI無効)
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "enableAI": false,
    "saveToDB": false
  }' | jq '{
    symbol,
    manipulation_score,
    signals: .signals | length,
    volume_analysis: {
      anomaly_detected,
      anomaly_score
    },
    price_manipulation: {
      detected,
      score
    }
  }'
```

### 2. 出来高異常検知
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "TSLA", "enableAI": false}' \
  | jq '.volume_analysis'
```

### 3. 価格操作パターン
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA", "enableAI": false}' \
  | jq '.price_manipulation'
```

---

## Phase 2: SEC/FINRA統合テスト

### 4. 空売りデータ
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "GME", "enableAI": false}' \
  | jq '.short_interest'
```

### 5. ダークプール分析
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AMC", "enableAI": false}' \
  | jq '.dark_pool'
```

### 6. 機関投資家フロー
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "MSFT", "enableAI": false}' \
  | jq '.institutional_activity'
```

### 7. 13Fホールディングス
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "GOOGL", "enableAI": false}' \
  | jq '.institutional_activity.recent_13f_holdings[0:3]'
```

---

## Phase 3: AI統合テスト

### 8. クイックAI分析 (Gemini)
```bash
curl -X POST ${BASE_URL}/api/institutional/ai-quick \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "ai": "gemini"
  }' | jq '{
    symbol,
    ai,
    analysis: {
      manipulation_likelihood,
      confidence,
      recommended_action
    }
  }'
```

### 9. 4AI合議分析
```bash
curl -X POST ${BASE_URL}/api/institutional/ai-consensus \
  -H "Content-Type: application/json" \
  -d '{"symbol": "TSLA"}' | jq '{
    symbol,
    consensus_available,
    responses_received,
    consensus: {
      manipulation_likelihood,
      confidence_score,
      agreement_level,
      recommended_action
    }
  }'
```

### 10. フルAI統合分析
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NVDA",
    "enableAI": true,
    "aiMode": "full",
    "saveToDB": false
  }' | jq '{
    symbol,
    manipulation_score,
    ai_analysis: {
      mode,
      consensus_available,
      responses_received
    }
  }'
```

---

## Phase 4: BigQuery & Alert テスト

### 11. DB保存テスト
```bash
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "enableAI": false,
    "saveToDB": true
  }' | jq '{
    symbol,
    db_save_status,
    alerts: .alerts | length
  }'
```

### 12. 履歴取得
```bash
# 操作シグナル履歴
curl "${BASE_URL}/api/institutional/history/AAPL?days=30" \
  | jq '{
    symbol,
    period_days,
    total_records,
    latest: .history[0]
  }'

# AI分析履歴
curl "${BASE_URL}/api/institutional/ai-history/AAPL?days=30" \
  | jq '.'
```

### 13. アラート取得
```bash
# 高リスクアラート
curl "${BASE_URL}/api/institutional/alerts?threshold=0.7&limit=10" \
  | jq '{threshold, total, alerts: .alerts[0:3]}'

# アクティブアラート
curl "${BASE_URL}/api/institutional/alerts/active" \
  | jq '.summary'
```

### 14. 統計サマリー
```bash
curl "${BASE_URL}/api/institutional/stats?days=30" \
  | jq '.'
```

### 15. トレンド分析
```bash
curl "${BASE_URL}/api/institutional/trend/TSLA" \
  | jq '.'
```

### 16. 監視リスト管理
```bash
# 監視リスト取得
curl "${BASE_URL}/api/institutional/watchlist" | jq '.'

# シンボル追加
curl -X POST ${BASE_URL}/api/institutional/watchlist \
  -H "Content-Type: application/json" \
  -d '{"symbol": "TSLA"}' | jq '.'

curl -X POST ${BASE_URL}/api/institutional/watchlist \
  -H "Content-Type: application/json" \
  -d '{"symbol": "NVDA"}' | jq '.'

# 監視リスト確認
curl "${BASE_URL}/api/institutional/watchlist" | jq '.symbols'

# シンボル削除
curl -X DELETE ${BASE_URL}/api/institutional/watchlist/NVDA | jq '.'
```

### 17. 監視制御
```bash
# 設定確認
curl "${BASE_URL}/api/institutional/monitoring/config" | jq '.'

# 設定更新
curl -X PUT ${BASE_URL}/api/institutional/monitoring/config \
  -H "Content-Type: application/json" \
  -d '{
    "HIGH_RISK_THRESHOLD": 0.8,
    "MEDIUM_RISK_THRESHOLD": 0.5
  }' | jq '.'

# 監視開始
curl -X POST ${BASE_URL}/api/institutional/monitoring/start | jq '.'

# 監視停止
curl -X POST ${BASE_URL}/api/institutional/monitoring/stop | jq '.'
```

---

## 統合テストシナリオ

### シナリオ 1: 新規銘柄の完全分析
```bash
SYMBOL="AAPL"

echo "=== 1. 完全分析実行 ==="
curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"symbol\": \"${SYMBOL}\",
    \"enableAI\": true,
    \"aiMode\": \"quick\",
    \"saveToDB\": true
  }" | jq '{
    symbol,
    manipulation_score,
    signals: .signals | length,
    ai_analysis: .ai_analysis.mode,
    db_saved: .db_save_status.saved
  }'

echo ""
echo "=== 2. 監視リストに追加 ==="
curl -X POST ${BASE_URL}/api/institutional/watchlist \
  -H "Content-Type: application/json" \
  -d "{\"symbol\": \"${SYMBOL}\"}" | jq '.success'

echo ""
echo "=== 3. トレンド確認 (5秒待機) ==="
sleep 5
curl "${BASE_URL}/api/institutional/trend/${SYMBOL}" | jq '.trend'
```

### シナリオ 2: リアルタイム監視
```bash
echo "=== 1. 複数銘柄を監視リストに追加 ==="
for symbol in AAPL TSLA NVDA MSFT; do
  curl -s -X POST ${BASE_URL}/api/institutional/watchlist \
    -H "Content-Type: application/json" \
    -d "{\"symbol\": \"${symbol}\"}" | jq -r ".symbol"
done

echo ""
echo "=== 2. 監視開始 ==="
curl -X POST ${BASE_URL}/api/institutional/monitoring/start \
  | jq '{success, message}'

echo ""
echo "=== 3. アクティブアラート確認 (60秒待機) ==="
sleep 60
curl "${BASE_URL}/api/institutional/alerts/active" \
  | jq '.summary'

echo ""
echo "=== 4. 監視停止 ==="
curl -X POST ${BASE_URL}/api/institutional/monitoring/stop \
  | jq '{success, message}'
```

### シナリオ 3: 複数銘柄一括分析
```bash
echo "=== 複数銘柄の操作スコア比較 ==="
for symbol in AAPL TSLA NVDA MSFT GOOGL; do
  echo "Analyzing ${symbol}..."
  score=$(curl -s -X POST ${BASE_URL}/api/institutional/analyze \
    -H "Content-Type: application/json" \
    -d "{
      \"symbol\": \"${symbol}\",
      \"enableAI\": false,
      \"saveToDB\": false
    }" | jq -r '.manipulation_score')
  
  echo "${symbol}: ${score}"
done
```

---

## パフォーマンステスト

### 1. レスポンス時間測定
```bash
echo "=== レスポンス時間測定 ==="
time curl -X POST ${BASE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "enableAI": false, "saveToDB": false}' \
  -o /dev/null -s
```

### 2. 並列リクエスト
```bash
echo "=== 5並列リクエスト ==="
for i in {1..5}; do
  curl -X POST ${BASE_URL}/api/institutional/analyze \
    -H "Content-Type: application/json" \
    -d '{"symbol": "AAPL", "enableAI": false, "saveToDB": false}' \
    -o /dev/null -s &
done
wait
echo "Complete"
```

---

## トラブルシューティング

### ヘルスチェック
```bash
curl ${BASE_URL}/health || echo "Server not responding"
```

### ログ確認
```bash
# サーバーログをリアルタイム表示
tail -f /path/to/server.log

# エラーログ検索
grep ERROR /path/to/server.log | tail -20
```

### データベース接続確認
```bash
# BigQueryテーブル初期化
curl -X POST ${BASE_URL}/api/admin/init-iaa-tables \
  | jq '.'
```

---

## 環境別テスト

### ローカル環境
```bash
export BASE_URL="http://localhost:8888"
```

### ステージング環境
```bash
export BASE_URL="https://magi-ac-staging-xxxxxx.run.app"
```

### 本番環境
```bash
export BASE_URL="https://magi-ac-prod-xxxxxx.run.app"
```

---

## 自動テストスクリプト

### 全機能テスト
```bash
#!/bin/bash
# test-all.sh

BASE_URL="http://localhost:8888"
PASS=0
FAIL=0

test_endpoint() {
  local name=$1
  local cmd=$2
  
  echo -n "Testing ${name}... "
  if eval ${cmd} > /dev/null 2>&1; then
    echo "✓ PASS"
    ((PASS++))
  else
    echo "✗ FAIL"
    ((FAIL++))
  fi
}

echo "=== IAA System Test Suite ==="
echo ""

test_endpoint "Basic Analysis" \
  "curl -s -X POST ${BASE_URL}/api/institutional/analyze -H 'Content-Type: application/json' -d '{\"symbol\":\"AAPL\",\"enableAI\":false}' | jq -e '.manipulation_score'"

test_endpoint "Watchlist Get" \
  "curl -s ${BASE_URL}/api/institutional/watchlist | jq -e '.total >= 0'"

test_endpoint "Watchlist Add" \
  "curl -s -X POST ${BASE_URL}/api/institutional/watchlist -H 'Content-Type: application/json' -d '{\"symbol\":\"TEST\"}' | jq -e '.success'"

test_endpoint "Active Alerts" \
  "curl -s ${BASE_URL}/api/institutional/alerts/active | jq -e '.summary'"

test_endpoint "Monitoring Config" \
  "curl -s ${BASE_URL}/api/institutional/monitoring/config | jq -e '.HIGH_RISK_THRESHOLD'"

echo ""
echo "=== Results ==="
echo "PASS: ${PASS}"
echo "FAIL: ${FAIL}"
echo "Total: $((PASS + FAIL))"

exit ${FAIL}
```

実行:
```bash
chmod +x test-all.sh
./test-all.sh
```

---

## 期待されるレスポンス例

### 成功レスポンス
```json
{
  "symbol": "AAPL",
  "manipulation_score": 0.65,
  "signals": [...],
  "db_save_status": {
    "saved": true
  }
}
```

### エラーレスポンス
```json
{
  "error": "Institutional analysis failed",
  "details": "Symbol is required"
}
```

---

## メトリクス収集

### API使用状況
```bash
# リクエスト数カウント
grep "POST /api/institutional/analyze" /path/to/access.log | wc -l

# エラー率
grep "ERROR" /path/to/server.log | wc -l
```

### パフォーマンス分析
```bash
# 平均レスポンス時間
for i in {1..10}; do
  time curl -s -X POST ${BASE_URL}/api/institutional/analyze \
    -H "Content-Type: application/json" \
    -d '{"symbol": "AAPL", "enableAI": false}' \
    -o /dev/null 2>&1 | grep real
done
```
