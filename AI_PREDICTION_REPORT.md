# AI株価予測機能 実装レポート

## 概要

4つのAI（Grok, Gemini, Claude, Mistral）を統合し、テクニカル指標と組み合わせた高度な株価予測システムを実装しました。

## 実装完了日
2025-11-28

## アーキテクチャ

```
[Yahoo Finance API]
      ↓
[Historical Data 60 days]
      ↓
[Technical Indicators]
  - RSI (14)
  - MACD (12, 26, 9)
  - Bollinger Bands (20, 2)
  - SMA (20, 50)
      ↓
[Prediction Engine] ←→ [4 AI Predictors]
      ↓                 - Grok (革新的)
[Consensus]             - Gemini (論理的)
      ↓                 - Claude (倫理的)
[BigQuery Storage]      - Mistral (バランス)
      ↓
[REST API Endpoints]
```

## コンポーネント

### 1. predictors/ai-predictor.js

4つのAIから予測を取得する中核モジュール。

**機能:**
- `getGrokPrediction()` - Grok AIから予測取得
- `getGeminiPrediction()` - Gemini AIから予測取得
- `getClaudePrediction()` - Claude AIから予測取得
- `getMistralPrediction()` - Mistral AIから予測取得
- `get4AIPredictions()` - 4AI並列実行
- `generateMockPredictions()` - モックデータ生成

**予測期間別プロンプト:**
- **1day**: 短期トレンド、オシレーター重視
- **1week**: テクニカル指標の方向性、短期カタリスト
- **1month**: 中期トレンド、決算スケジュール、業界動向
- **3months**: 四半期決算、セクターローテーション、ファンダメンタルズ
- **2years**: 長期成長ストーリー、技術革新、ESG

**AI応答フォーマット:**
```json
{
  "predicted_price": 185.50,
  "direction": "UP",
  "confidence": 0.75,
  "reasoning": "強気のテクニカル指標と好決算期待"
}
```

### 2. analyzers/prediction-engine.js

テクニカル分析とAI予測を統合するエンジン。

**機能:**
- `calculateRSI()` - Relative Strength Index計算
- `calculateMACD()` - Moving Average Convergence Divergence計算
- `calculateBollingerBands()` - ボリンジャーバンド計算
- `calculateSMA()` - Simple Moving Average計算
- `calculateTechnicalIndicators()` - 全指標統合計算
- `predictStockPrice()` - メイン予測関数
- `predictMultipleStocks()` - バッチ予測

**コンセンサス生成:**
- 信頼度による加重平均で予測価格を算出
- 方向性の多数決でトレンドを決定
- 合意レベル（agreement_level）を計算

### 3. bigquery/iaa-storage.js（拡張）

予測結果の保存・取得機能を追加。

**新規関数:**
- `savePrediction()` - 予測結果保存
- `getPredictionHistory()` - 予測履歴取得
- `analyzePredictionAccuracy()` - 予測精度分析
- `initializePredictionsTable()` - テーブル初期化

**BigQueryスキーマ（predictions）:**
```
- id: STRING (REQUIRED)
- symbol: STRING (REQUIRED)
- horizon: STRING (REQUIRED)
- timestamp: TIMESTAMP (REQUIRED)
- current_price: FLOAT64 (REQUIRED)
- predicted_price: FLOAT64 (REQUIRED)
- price_change_percent: FLOAT64
- direction: STRING (REQUIRED)
- confidence: FLOAT64 (REQUIRED)
- upvotes: INT64 (REQUIRED)
- downvotes: INT64 (REQUIRED)
- neutral: INT64 (REQUIRED)
- agreement_level: FLOAT64 (REQUIRED)
- ai_predictions: STRING (JSON)
- ai_responses: INT64 (REQUIRED)
- rsi: FLOAT64
- macd: FLOAT64
- bb_position: FLOAT64
- trend: STRING
- created_at: TIMESTAMP (REQUIRED)
```

### 4. src/index.js（拡張）

REST APIエンドポイントを追加。

**新規エンドポイント:**

#### POST /api/predict
単一銘柄の予測実行

**リクエスト:**
```json
{
  "symbol": "AAPL",
  "horizon": "3months",
  "enableAI": false
}
```

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "horizon": "3months",
    "timestamp": "2025-11-28T08:00:00Z",
    "current_price": 180.25,
    "technical_indicators": {
      "rsi": 65.5,
      "macd": 2.3,
      "bb_position": 0.75,
      "trend": "bullish"
    },
    "ai_predictions": [
      {
        "ai": "Grok",
        "predicted_price": 195.50,
        "direction": "UP",
        "confidence": 0.72,
        "reasoning": "..."
      },
      ...
    ],
    "consensus": {
      "predicted_price": 190.25,
      "price_change_percent": 5.55,
      "direction": "UP",
      "confidence": 0.68,
      "upvotes": 3,
      "downvotes": 0,
      "neutral": 1,
      "agreement_level": 0.75
    }
  }
}
```

#### POST /api/predict/batch
複数銘柄のバッチ予測

**リクエスト:**
```json
{
  "symbols": ["AAPL", "TSLA", "NVDA"],
  "horizon": "1month",
  "enableAI": false
}
```

#### GET /api/predict/history/:symbol
予測履歴取得

**クエリパラメータ:**
- `horizon` (optional): 期間フィルター
- `days` (default: 30): 取得日数

#### GET /api/predict/accuracy/:symbol
予測精度分析

**クエリパラメータ:**
- `horizon` (default: "1day"): 対象期間
- `days` (default: 30): 分析日数

#### POST /api/admin/init-predictions-table
予測テーブル初期化

## 使用方法

### 1. 環境変数設定

```bash
# .env ファイル
BIGQUERY_ENABLED=true
GCP_PROJECT_ID=your-project-id

# AI API Keys (オプション)
XAI_API_KEY=your-grok-key
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-claude-key
MISTRAL_API_KEY=your-mistral-key
```

### 2. サーバー起動

```bash
npm start
# または
node src/index.js
```

### 3. テスト実行

```bash
# 自動テストスクリプト
./test-prediction.sh

# または手動テスト
curl -X POST http://localhost:8888/api/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","horizon":"3months","enableAI":false}'
```

## 予測期間とユースケース

| Horizon | 営業日数 | ユースケース | 重視項目 |
|---------|---------|--------------|----------|
| 1day | 1日 | デイトレード | テクニカル、板情報 |
| 1week | 5日 | スイングトレード | 短期トレンド、カタリスト |
| 1month | 20日 | 短期投資 | テクニカル + ファンダメンタルズ |
| 3months | 60日 | 中期投資 | 決算、業界動向 |
| 2years | 480日 | 長期投資 | 成長戦略、競争優位性 |

## AIの役割分担

| AI | 特徴 | 温度 | 重視ポイント |
|----|------|------|--------------|
| Grok | 革新的・創造的 | 0.5 | 新しい視点、破壊的イノベーション |
| Gemini | 科学的・論理的 | 0.2 | データドリブン、統計的分析 |
| Claude | 人間的・倫理的 | 0.4 | リスク評価、ESG |
| Mistral | バランス重視 | 0.3 | リスク・リターンの均衡 |

## モックモード

AI APIキーがない場合やテスト時は `enableAI=false` でモックデータを生成。

**特徴:**
- 予測期間に応じた変動率を自動調整
- 各AIの性格を反映したレスポンス
- コンセンサス計算は実データと同じロジック

## BigQueryデータ分析

### 予測履歴クエリ

```sql
SELECT 
  symbol,
  horizon,
  timestamp,
  current_price,
  predicted_price,
  price_change_percent,
  direction,
  confidence,
  agreement_level
FROM `magi_ac.predictions`
WHERE symbol = 'AAPL'
  AND horizon = '3months'
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
ORDER BY timestamp DESC;
```

### AI別の予測精度

```sql
SELECT 
  symbol,
  horizon,
  JSON_EXTRACT_SCALAR(ai_predictions, '$[0].ai') as ai_name,
  AVG(CAST(JSON_EXTRACT_SCALAR(ai_predictions, '$[0].confidence') AS FLOAT64)) as avg_confidence,
  COUNT(*) as prediction_count
FROM `magi_ac.predictions`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
GROUP BY symbol, horizon, ai_name
ORDER BY avg_confidence DESC;
```

### トレンド分析

```sql
SELECT 
  symbol,
  DATE(timestamp) as prediction_date,
  AVG(predicted_price) as avg_predicted_price,
  AVG(current_price) as avg_current_price,
  AVG(price_change_percent) as avg_change_percent
FROM `magi_ac.predictions`
WHERE symbol = 'AAPL'
  AND horizon = '1month'
  AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY symbol, prediction_date
ORDER BY prediction_date DESC;
```

## パフォーマンス

- **単一予測**: 約10-15秒（AI有効時）/ 1秒未満（モック）
- **バッチ予測**: 銘柄数 × 10秒 + レート制限待機
- **履歴取得**: 1秒未満（BigQuery）
- **同時実行**: 4AI並列実行で高速化

## エラーハンドリング

1. **AI API障害**: 他のAIで補完、最小1つあればコンセンサス生成
2. **履歴データ不足**: テクニカル指標なしで予測継続
3. **無効なhorizon**: 400エラーで有効な選択肢を返す
4. **BigQuery保存失敗**: 警告ログのみ、API応答は成功

## セキュリティ

- API Keyは環境変数で管理
- BigQueryアクセスはサービスアカウント認証
- バッチ予測は10銘柄まで制限（DoS対策）
- タイムアウト設定（20秒）

## 今後の拡張

1. **予測精度追跡**: 実際の価格と比較して精度を自動計算
2. **アンサンブル学習**: 過去の精度に基づいてAIの重みを動的調整
3. **感情分析統合**: ニュース・SNSセンチメントを追加
4. **リアルタイム更新**: WebSocketで予測をストリーミング
5. **バックテスト機能**: 過去データで予測精度を検証

## テスト結果

```bash
./test-prediction.sh
```

✅ 予測テーブル初期化成功
✅ 1day予測（モック）成功
✅ 1week予測（モック）成功
✅ 3months予測（モック）成功
✅ バッチ予測成功
✅ 履歴取得成功

## まとめ

- ✅ 4AI統合予測システム構築完了
- ✅ テクニカル指標計算実装完了
- ✅ 予測期間別プロンプト最適化完了
- ✅ BigQuery保存・取得機能完了
- ✅ REST APIエンドポイント完了
- ✅ モックモード実装完了
- ✅ テストスクリプト作成完了

**MAGI Analytics Center v3.2 - AI株価予測機能 実装完了！**
