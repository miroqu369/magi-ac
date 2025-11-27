# Cloud Shell セットアップガイド

## 機関投資家分析機能のデプロイ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/dogmaai/magi-ac.git
cd magi-ac
git checkout institutional-analysis
```

### 2. 環境変数の設定

```bash
# .envファイルを作成
cp .env.example .env

# 必要なAPIキーを設定
nano .env
```

必須の環境変数:
```
# Yahoo Finance (無料)
YAHOO_FINANCE_ENABLED=true

# Google Cloud BigQuery
GCP_PROJECT_ID=your-project-id
BIGQUERY_DATASET=magi_analytics

# AI APIs (オプション)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_API_KEY=your-google-ai-key
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. BigQueryテーブルの作成

```bash
# BigQueryテーブル作成スクリプトを実行
node bigquery/iaa-storage.js --create-tables
```

### 5. 機能のテスト

```bash
# 全機能のテスト
./test-all.sh

# 個別テスト
node src/index.js analyze AAPL institutional
node src/index.js analyze TSLA manipulation
node src/index.js analyze NVDA volume-anomaly
```

### 6. Cloud Runへのデプロイ

```bash
# デプロイスクリプトを実行
chmod +x deploy-cloudrun.sh
./deploy-cloudrun.sh
```

## 主要ファイル一覧

### コアファイル
- `src/index.js` - メインエントリーポイント
- `package.json` - 依存関係定義

### データ収集 (collectors/)
- `collectors/yahoo-finance.js` - 株価・出来高データ
- `collectors/sec-edgar.js` - SEC提出書類
- `collectors/finra-darkpool.js` - ダークプール取引
- `collectors/finra-shorts.js` - 空売りデータ

### 分析エンジン (analyzers/)
- `analyzers/institutional-flow.js` - 機関投資家フロー分析
- `analyzers/volume-anomaly.js` - 出来高異常検知
- `analyzers/price-manipulation.js` - 価格操作検知

### AI統合 (ai/)
- `ai/manipulation-detector.js` - AI価格操作検知

### データストレージ (bigquery/)
- `bigquery/iaa-storage.js` - BigQuery保存・取得

### ユーティリティ (utils/)
- `utils/alert-system.js` - アラート通知システム

### デプロイ
- `Dockerfile` - Dockerイメージ定義
- `deploy-cloudrun.sh` - Cloud Runデプロイスクリプト
- `.dockerignore` - Docker除外ファイル

### ドキュメント
- `IAA_IMPLEMENTATION_REPORT.md` - 実装レポート
- `PHASE3_AI_INTEGRATION_REPORT.md` - AI統合レポート
- `PHASE4_BIGQUERY_ALERT_REPORT.md` - BigQuery/アラートレポート
- `TEST_COMMANDS.md` - テストコマンド集

## APIエンドポイント

デプロイ後、以下のエンドポイントが利用可能:

```bash
# 機関投資家分析
curl https://your-service.run.app/api/analyze/institutional?symbol=AAPL

# 価格操作検知
curl https://your-service.run.app/api/analyze/manipulation?symbol=TSLA

# 出来高異常検知
curl https://your-service.run.app/api/analyze/volume-anomaly?symbol=NVDA

# 履歴データ取得
curl https://your-service.run.app/api/history/institutional?symbol=AAPL&days=30
```

## トラブルシューティング

### BigQueryエラー
```bash
# サービスアカウントの権限確認
gcloud projects get-iam-policy $GCP_PROJECT_ID

# BigQuery管理者権限を付与
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:your-sa@project.iam.gserviceaccount.com" \
  --role="roles/bigquery.admin"
```

### メモリ不足エラー
```bash
# Cloud Runのメモリを増やす
gcloud run services update magi-analytics \
  --memory 2Gi \
  --region us-central1
```

## 監視とログ

```bash
# Cloud Runログの確認
gcloud run services logs read magi-analytics --limit 50

# BigQueryデータの確認
bq query --use_legacy_sql=false \
  'SELECT * FROM `magi_analytics.institutional_flow` 
   ORDER BY timestamp DESC LIMIT 10'
```

## サポート

詳細は各レポートファイルを参照:
- 実装詳細: `IAA_IMPLEMENTATION_REPORT.md`
- AI機能: `PHASE3_AI_INTEGRATION_REPORT.md`
- BigQuery/アラート: `PHASE4_BIGQUERY_ALERT_REPORT.md`
