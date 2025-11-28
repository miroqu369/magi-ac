# AI株価予測 - クイックスタート

## 概要
4つのAI（Grok, Gemini, Claude, Mistral）による統合株価予測システム

## セットアップ

```bash
# 1. リポジトリクローン
git clone https://github.com/dogmaai/magi-ac.git
cd magi-ac
git checkout institutional-analysis

# 2. 依存関係インストール
npm install

# 3. 環境変数設定（オプション）
cp .env.example .env
# .env を編集してAPI Keyを設定
```

## 使い方

### サーバー起動
```bash
npm start
# ポート 8888 で起動
```

### モックモードでテスト（API Keyなしで動作）
```bash
./test-prediction.sh
```

### API呼び出し例

#### 3ヶ月予測（モック）
```bash
curl -X POST http://localhost:8888/api/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","horizon":"3months","enableAI":false}'
```

#### AI有効で予測（API Key必要）
```bash
curl -X POST http://localhost:8888/api/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","horizon":"3months","enableAI":true}'
```

#### バッチ予測
```bash
curl -X POST http://localhost:8888/api/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","TSLA","NVDA"],"horizon":"1month","enableAI":false}'
```

#### 予測履歴取得
```bash
curl http://localhost:8888/api/predict/history/AAPL?days=7
```

## 予測期間

- `1day` - 翌営業日予測（デイトレード）
- `1week` - 1週間後予測（スイングトレード）
- `1month` - 1ヶ月後予測（短期投資）
- `3months` - 3ヶ月後予測（中期投資）★おすすめ
- `2years` - 2年後予測（長期投資）

## レスポンス例

```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "horizon": "3months",
    "current_price": 180.25,
    "consensus": {
      "predicted_price": 190.25,
      "price_change_percent": 5.55,
      "direction": "UP",
      "confidence": 0.68,
      "upvotes": 3,
      "downvotes": 0,
      "neutral": 1
    },
    "ai_predictions": [
      {
        "ai": "Grok",
        "predicted_price": 195.50,
        "direction": "UP",
        "confidence": 0.72,
        "reasoning": "革新的な成長戦略と市場拡大の可能性を評価..."
      },
      ...
    ]
  }
}
```

## モックモード vs AI有効

| 項目 | モックモード | AI有効 |
|-----|-------------|--------|
| API Key | 不要 | 必要 |
| 速度 | 高速（1秒） | 遅い（10-15秒） |
| 精度 | 固定パターン | リアルタイム分析 |
| 用途 | テスト・開発 | 本番運用 |

## 必要なAPI Key（AI有効時）

```env
XAI_API_KEY=your-grok-key
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-claude-key
MISTRAL_API_KEY=your-mistral-key
```

## トラブルシューティング

### エラー: "Symbol is required"
→ リクエストボディに `symbol` を含めてください

### エラー: "Invalid horizon"
→ 有効な予測期間: `1day, 1week, 1month, 3months, 2years`

### AI予測が遅い
→ 4つのAIを並列実行していますが、各AIの応答に時間がかかります
→ まずは `enableAI=false` でテストしてください

## ドキュメント

詳細は以下を参照：
- [AI_PREDICTION_REPORT.md](./AI_PREDICTION_REPORT.md) - 実装詳細
- [TEST_COMMANDS.md](./TEST_COMMANDS.md) - テストコマンド集

## サポート

Issue: https://github.com/dogmaai/magi-ac/issues
