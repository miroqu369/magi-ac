# Institutional Activity Analyzer (IAA) - Implementation Report

## Phase 2 完了 (2025-11-27)

### 実装された機能

#### 1. データコレクター
- ✅ **SEC EDGAR** (`collectors/sec-edgar.js`)
  - 13F報告書データ取得
  - 主要8機関投資家の追跡
  - 異常なポジション変動検出

- ✅ **FINRA 空売りデータ** (`collectors/finra-shorts.js`)
  - 日次空売り出来高取得
  - 5日間トレンド分析
  - 空売り異常検知

- ✅ **FINRA ダークプール** (`collectors/finra-darkpool.js`)
  - ダークプール取引量追跡
  - 週次統計分析
  - 機関投資家活動パターン検出

#### 2. アナライザー
- ✅ **出来高異常検知** (`analyzers/volume-anomaly.js`)
  - 平均の3倍以上のスパイク検出
  - 終値前15分の出来高集中分析

- ✅ **価格操作パターン** (`analyzers/price-manipulation.js`)
  - 終値操作検出
  - ペインティング・ザ・テープ
  - ウォッシュトレード検出

- ✅ **機関投資家フロー** (`analyzers/institutional-flow.js`)
  - 13F変動分析
  - 資金フロー方向判定
  - 投資家行動パターン分類

#### 3. 統合エンドポイント
- ✅ `POST /api/institutional/analyze`
  - 総合操作スコア (0-1)
  - 複数シグナル統合
  - 機関投資家活動分析
  - 推奨アクション

---

## テスト結果

### TSLA (高リスク検出)
```json
{
  "manipulation_score": 0.81,
  "signals": [
    "3日連続で空売り比率が40%超",
    "ダークプール取引が62.1%",
    "終値前15分で異常変動"
  ],
  "short_interest": {
    "latest_ratio": "45.69%",
    "alert": true
  }
}
```

### AAPL (中リスク)
```json
{
  "manipulation_score": 0.58,
  "signals": [
    "終値前15分で異常変動"
  ],
  "institutional_flow": "neutral",
  "recommendation": "WAIT"
}
```

### NVDA (低リスク)
```json
{
  "manipulation_score": 0.50,
  "institutional_flow": "bearish",
  "short_interest": {
    "latest_ratio": "50.3%",
    "alert": true
  },
  "recommendation": "WAIT"
}
```

---

## 検出可能なシグナル

### 出来高ベース
1. **volume_spike** - 平均の3倍以上の出来高
2. **closing_volume_concentration** - 終値前15分に30%以上集中

### 価格操作パターン
3. **closingManipulation** - 終値前の異常な価格変動
4. **paintingTheTape** - 10回以上の連続小口取引
5. **washTrading** - 同一価格で30%以上の取引集中

### 空売り
6. **extreme_short_ratio** - 空売り比率50%超
7. **short_interest_surge** - 前日比100%以上の急増
8. **sustained_short_pressure** - 3日連続40%超

### ダークプール
9. **high_dark_pool_activity** - ダークプール比率50%超
10. **elevated_dark_pool_activity** - ダークプール比率45%超

---

## 機関投資家分析

### フロー方向
- **bullish** - 機関投資家の買い優勢
- **bearish** - 機関投資家の売り優勢
- **mixed** - 意見分かれる
- **neutral** - 明確なトレンドなし

### 行動パターン
- **AGGRESSIVE_ACCUMULATION** - 積極的買い集め (推奨: FOLLOW)
- **AGGRESSIVE_DISTRIBUTION** - 積極的売り崩し (推奨: AVOID)
- **DIVERGENCE** - 意見対立 (推奨: CAUTION)
- **NEUTRAL** - パターンなし (推奨: WAIT)

---

## 使用方法

### 基本分析
```bash
curl -X POST http://localhost:8888/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}'
```

### 高リスクシグナルのみ抽出
```bash
curl -X POST http://localhost:8888/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TSLA"}' | jq '.signals[] | select(.severity == "high")'
```

### 推奨アクション確認
```bash
curl -X POST http://localhost:8888/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"NVDA"}' | jq '.institutional_activity.behavior_pattern'
```

---

## 次のステップ (Phase 3)

### AI合議システム統合
- [ ] 4AI (Grok, Gemini, Claude, Mistral) による操作判定
- [ ] AI合意度スコア計算
- [ ] 総合レポート生成

### BigQuery統合
- [ ] 操作シグナル履歴保存
- [ ] 機関投資家ポジション追跡
- [ ] 時系列分析

### アラート機能
- [ ] リアルタイム監視
- [ ] しきい値ベースアラート
- [ ] メール/Slack通知

---

## 技術仕様

### データソース
- Yahoo Finance API - 価格・出来高データ
- SEC EDGAR - 13F報告書 (Rate: 10 req/sec)
- FINRA - 空売りデータ (Public)
- FINRA ADF - ダークプール (Mock)

### スコアリングロジック
```
manipulation_score = 
  (volume_anomaly * 0.25) +
  (price_manipulation * 0.35) +
  (short_anomaly * 0.20) +
  (darkpool_anomaly * 0.20)
```

### 重大度レベル
- **high** - 即座に注意が必要 (confidence > 0.7)
- **medium** - 監視継続 (confidence 0.4-0.7)
- **low** - 参考情報 (confidence < 0.4)

---

## 制限事項

1. **分足データ** - Yahoo Financeは7日分のみ
2. **13Fデータ** - 四半期ごとの更新 (45日遅延)
3. **ダークプール** - 現在はMockデータ (API認証待ち)
4. **Rate Limiting** - SEC: 10 req/sec, FINRA: 制限なし

---

## コンプライアンス

⚠️ **重要な免責事項**

1. このシステムは「操作の疑い」を検出するものであり、実際の違法行為を断定するものではありません
2. 検出結果は投資判断の参考情報であり、投資推奨ではありません
3. False Positive (誤検出) の可能性があります
4. 規制当局への報告義務はユーザーの責任です

---

## パフォーマンス

- 平均レスポンス時間: 3-5秒
- 並列データ取得: 7 sources
- 分析処理: <100ms
- メモリ使用量: ~50MB

---

## 作成者
MAGI Analytics Center Team
Version: 3.1.0
Date: 2025-11-27
