# MAGI AC Cloud Run デプロイ手順

## 🎯 目的

magi-ac の最新版（institutional-analysis ブランチ）を Cloud Run にデプロイする

---

## 📋 前提条件

- Google Cloud Shell にアクセス可能
- プロジェクト: screen-share-459802
- 権限: Cloud Run Admin, Service Account User

---

## 🚀 方法1: 自動デプロイスクリプト（推奨）

### ステップ1: Cloud Shell を開く
Google Cloud Console → 右上のターミナルアイコンをクリック

### ステップ2: スクリプトを実行
```bash
# リポジトリをクローン（初回のみ）
git clone https://github.com/dogmaai/magi-ac.git
cd magi-ac
git checkout institutional-analysis

# デプロイスクリプトを実行
./deploy-to-cloud-run.sh
```

### 所要時間
約5-10分

---

## 🔧 方法2: 手動デプロイ

### ステップ1: コードを取得
```bash
# 新規クローン
git clone https://github.com/dogmaai/magi-ac.git
cd magi-ac
git checkout institutional-analysis

# または既存リポジトリを更新
cd ~/magi-ac
git fetch origin
git checkout institutional-analysis
git pull origin institutional-analysis
```

### ステップ2: デプロイコマンド実行
```bash
gcloud run deploy magi-ac \
  --source=. \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300s \
  --max-instances=10 \
  --set-env-vars="PORT=8888"
```

### ステップ3: デプロイ完了を待つ
- ビルド: 約3-5分
- デプロイ: 約1-2分

### ステップ4: サービスURL確認
```bash
gcloud run services describe magi-ac \
  --region=asia-northeast1 \
  --format='value(status.url)'
```

---

## ✅ デプロイ後の検証

### 1. ヘルスチェック
```bash
SERVICE_URL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(status.url)')
curl -s "$SERVICE_URL/health" | jq .
```

**期待される結果:**
```json
{
  "status": "ok",
  "version": "3.2.0",
  "service": "MAGI Analytics Center",
  "timestamp": "2025-11-28T..."
}
```

### 2. consensus 動作確認
```bash
curl -s -X POST "$SERVICE_URL/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}' | jq '{symbol, consensus}'
```

**期待される結果:**
```json
{
  "symbol": "AAPL",
  "consensus": {
    "recommendation": "HOLD",
    "buy": 0,
    "hold": 4,
    "sell": 0,
    "average_confidence": "0.50"
  }
}
```

### 3. AI予測機能確認
```bash
curl -s -X POST "$SERVICE_URL/api/predict" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"TSLA","horizon":"3months","enableAI":false}' | jq '{symbol, predicted_price, direction}'
```

---

## 🐛 トラブルシューティング

### エラー1: ビルド失敗
```
ERROR: failed to build
```

**解決策:**
```bash
# package.json を確認
cat package.json

# node_modules を削除してリトライ
rm -rf node_modules
gcloud run deploy magi-ac --source=. --region=asia-northeast1
```

### エラー2: 権限エラー
```
ERROR: Permission denied
```

**解決策:**
```bash
# 現在のアカウント確認
gcloud auth list

# プロジェクト確認
gcloud config get-value project

# 必要に応じて再認証
gcloud auth login
```

### エラー3: タイムアウト
```
ERROR: Deployment timeout
```

**解決策:**
- タイムアウト時間を延長
```bash
gcloud run deploy magi-ac \
  --source=. \
  --region=asia-northeast1 \
  --timeout=600s
```

---

## 📊 デプロイ設定詳細

| 設定項目 | 値 | 説明 |
|---------|-----|------|
| サービス名 | magi-ac | Cloud Run サービス名 |
| リージョン | asia-northeast1 | 東京リージョン |
| メモリ | 1Gi | メモリ割り当て |
| CPU | 1 | CPU割り当て |
| タイムアウト | 300s | リクエストタイムアウト |
| 最大インスタンス数 | 10 | 自動スケーリング上限 |
| 認証 | なし | パブリックアクセス |

---

## 🎯 デプロイ後の確認チェックリスト

- [ ] ヘルスチェックが200 OKを返す
- [ ] /api/analyze で consensus が null でない
- [ ] /api/predict が正常に動作
- [ ] Cloud Runコンソールでサービスが「Ready」状態
- [ ] ログにエラーが出ていない

---

## 📝 補足情報

### 環境変数
デフォルトでは以下が設定されます:
- `PORT=8888` - サーバーポート
- その他のAPI Keyは .env または Secret Manager で管理

### ログ確認
```bash
# 最新のログを表示
gcloud run services logs read magi-ac --region=asia-northeast1 --limit=50

# エラーログのみ表示
gcloud run services logs read magi-ac --region=asia-northeast1 --limit=50 | grep ERROR
```

### ロールバック
```bash
# 以前のリビジョンを確認
gcloud run revisions list --service=magi-ac --region=asia-northeast1

# 特定のリビジョンにロールバック
gcloud run services update-traffic magi-ac \
  --region=asia-northeast1 \
  --to-revisions=magi-ac-00001-abc=100
```

---

## 🎊 完了

デプロイが成功したら、以下のURLでアクセス可能になります:

**本番URL:**
https://magi-ac-398890937507.asia-northeast1.run.app

**主要エンドポイント:**
- GET `/health` - ヘルスチェック
- POST `/api/analyze` - 株価分析（4AI合議）
- POST `/api/predict` - AI価格予測
- POST `/api/predict/batch` - バッチ予測

---

**作成日:** 2025-11-28  
**更新日:** 2025-11-28  
**作成者:** Claude AI Assistant
