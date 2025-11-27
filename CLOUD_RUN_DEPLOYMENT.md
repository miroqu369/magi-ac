# Cloud Run デプロイ手順

## 前提条件

- Google Cloud Platform (GCP) アカウント
- gcloud CLI インストール済み
- Docker インストール済み
- BigQuery API 有効化
- Cloud Run API 有効化

---

## Step 1: プロジェクト準備

### 1.1 GCP プロジェクト設定

```bash
# プロジェクトID設定
export PROJECT_ID="your-project-id"
export REGION="asia-northeast1"  # 東京リージョン
export SERVICE_NAME="magi-ac"

# プロジェクト選択
gcloud config set project ${PROJECT_ID}

# 必要なAPIを有効化
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  bigquery.googleapis.com
```

### 1.2 サービスアカウント作成

```bash
# サービスアカウント作成
gcloud iam service-accounts create ${SERVICE_NAME}-sa \
  --display-name="MAGI AC Service Account"

# BigQuery権限付与
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# 認証鍵ダウンロード
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com
```

---

## Step 2: Dockerfile 作成

### 2.1 Dockerfile

```dockerfile
# magi-ac/Dockerfile
FROM node:20-slim

# 作業ディレクトリ
WORKDIR /app

# 依存関係ファイルをコピー
COPY package*.json ./

# 依存関係インストール
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# ポート公開
EXPOSE 8080

# 環境変数
ENV NODE_ENV=production
ENV PORT=8080

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# アプリケーション起動
CMD ["node", "src/index.js"]
```

### 2.2 .dockerignore

```
# magi-ac/.dockerignore
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
*.md
*.backup
*.backup2
test/
docs/
.DS_Store
```

### 2.3 ヘルスチェックエンドポイント追加

```javascript
// src/index.js に追加
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.1.0'
  });
});
```

---

## Step 3: 環境変数設定

### 3.1 .env.production 作成

```bash
# magi-ac/.env.production
NODE_ENV=production
PORT=8080

# BigQuery
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json

# AI API Keys (Secret Manager推奨)
GEMINI_API_KEY=your-gemini-key
GROK_API_KEY=your-grok-key
CLAUDE_API_KEY=your-claude-key
MISTRAL_API_KEY=your-mistral-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3.2 Secret Manager 使用 (推奨)

```bash
# Secret作成
echo -n "your-gemini-api-key" | gcloud secrets create gemini-api-key \
  --data-file=-

echo -n "your-grok-api-key" | gcloud secrets create grok-api-key \
  --data-file=-

echo -n "your-claude-api-key" | gcloud secrets create claude-api-key \
  --data-file=-

echo -n "your-mistral-api-key" | gcloud secrets create mistral-api-key \
  --data-file=-

# サービスアカウントにSecret Manager権限付与
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 他のsecretも同様に設定
```

---

## Step 4: ビルド & デプロイ

### 4.1 ローカルでDockerビルドテスト

```bash
# Dockerビルド
docker build -t ${SERVICE_NAME}:latest .

# ローカル実行テスト
docker run -p 8080:8080 \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json \
  -v ~/gcp-key.json:/app/gcp-key.json:ro \
  ${SERVICE_NAME}:latest

# 別ターミナルでテスト
curl http://localhost:8080/health
```

### 4.2 Cloud Build でビルド

```bash
# Container Registry にプッシュ
gcloud builds submit \
  --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --timeout=20m
```

### 4.3 Cloud Run にデプロイ

#### オプション1: 基本デプロイ (Secret Manager使用)

```bash
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --service-account ${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 1 \
  --max-instances 10 \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,PORT=8080,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest,GROK_API_KEY=grok-api-key:latest,CLAUDE_API_KEY=claude-api-key:latest,MISTRAL_API_KEY=mistral-api-key:latest"
```

#### オプション2: YAML設定ファイル使用

```yaml
# service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: magi-ac
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: '1'
        autoscaling.knative.dev/maxScale: '10'
        run.googleapis.com/cpu-throttling: 'false'
    spec:
      serviceAccountName: magi-ac-sa@your-project-id.iam.gserviceaccount.com
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/your-project-id/magi-ac:latest
        ports:
        - containerPort: 8080
        resources:
          limits:
            memory: 2Gi
            cpu: '2'
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: '8080'
        - name: GOOGLE_CLOUD_PROJECT
          value: your-project-id
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: gemini-api-key
              key: latest
        - name: GROK_API_KEY
          valueFrom:
            secretKeyRef:
              name: grok-api-key
              key: latest
        - name: CLAUDE_API_KEY
          valueFrom:
            secretKeyRef:
              name: claude-api-key
              key: latest
        - name: MISTRAL_API_KEY
          valueFrom:
            secretKeyRef:
              name: mistral-api-key
              key: latest
```

デプロイ:
```bash
gcloud run services replace service.yaml --region ${REGION}
```

---

## Step 5: デプロイ後設定

### 5.1 BigQueryテーブル初期化

```bash
# サービスURLを取得
export SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format 'value(status.url)')

echo "Service URL: ${SERVICE_URL}"

# BigQueryテーブル作成
curl -X POST ${SERVICE_URL}/api/admin/init-iaa-tables
```

### 5.2 カスタムドメイン設定 (オプション)

```bash
# ドメインマッピング
gcloud run domain-mappings create \
  --service ${SERVICE_NAME} \
  --domain magi-ac.yourdomain.com \
  --region ${REGION}

# DNS設定の確認
gcloud run domain-mappings describe \
  --domain magi-ac.yourdomain.com \
  --region ${REGION}
```

---

## Step 6: 監視・ログ設定

### 6.1 Cloud Logging

```bash
# ログ表示
gcloud run services logs read ${SERVICE_NAME} \
  --region ${REGION} \
  --limit 50

# リアルタイムログ
gcloud run services logs tail ${SERVICE_NAME} \
  --region ${REGION}

# エラーログのみ
gcloud run services logs read ${SERVICE_NAME} \
  --region ${REGION} \
  --filter="severity>=ERROR" \
  --limit 20
```

### 6.2 Cloud Monitoring アラート設定

```bash
# アラートポリシー作成
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="MAGI AC High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="magi-ac"
    metric.type="run.googleapis.com/request_count"
    metric.labels.response_code_class="5xx"'
```

### 6.3 Uptime Check

```bash
# アップタイムチェック作成
gcloud monitoring uptime create ${SERVICE_NAME}-uptime \
  --resource-type=uptime-url \
  --display-name="MAGI AC Health Check" \
  --http-check-path=/health \
  --check-interval=60s \
  --timeout=10s
```

---

## Step 7: CI/CD パイプライン (Cloud Build)

### 7.1 cloudbuild.yaml

```yaml
# cloudbuild.yaml
steps:
  # ビルド
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/magi-ac:$SHORT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/magi-ac:latest'
      - '.'

  # プッシュ
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/magi-ac:$SHORT_SHA'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/magi-ac:latest'

  # デプロイ
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'magi-ac'
      - '--image'
      - 'gcr.io/$PROJECT_ID/magi-ac:$SHORT_SHA'
      - '--region'
      - 'asia-northeast1'
      - '--platform'
      - 'managed'
      - '--service-account'
      - 'magi-ac-sa@$PROJECT_ID.iam.gserviceaccount.com'

images:
  - 'gcr.io/$PROJECT_ID/magi-ac:$SHORT_SHA'
  - 'gcr.io/$PROJECT_ID/magi-ac:latest'

timeout: 1200s
```

### 7.2 GitHub連携

```bash
# Cloud Build トリガー作成
gcloud builds triggers create github \
  --repo-name=magi-ac \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Step 8: テスト

### 8.1 デプロイ確認

```bash
# ヘルスチェック
curl ${SERVICE_URL}/health

# 基本分析テスト
curl -X POST ${SERVICE_URL}/api/institutional/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "enableAI": false, "saveToDB": false}'
```

### 8.2 負荷テスト

```bash
# Apache Bench (簡易)
ab -n 100 -c 10 -H "Content-Type: application/json" \
  -p test-payload.json \
  ${SERVICE_URL}/api/institutional/analyze

# test-payload.json
{"symbol": "AAPL", "enableAI": false, "saveToDB": false}
```

---

## トラブルシューティング

### 問題: デプロイ失敗

```bash
# ビルドログ確認
gcloud builds list --limit=5

# 詳細ログ
gcloud builds log BUILD_ID
```

### 問題: BigQuery接続エラー

```bash
# サービスアカウント権限確認
gcloud projects get-iam-policy ${PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# BigQuery API有効化確認
gcloud services list --enabled | grep bigquery
```

### 問題: メモリ不足

```bash
# メモリ増量
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --memory 4Gi
```

### 問題: タイムアウト

```bash
# タイムアウト延長
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --timeout 600
```

---

## コスト最適化

### 1. 最小インスタンス数調整

```bash
# 0にすると完全スケールダウン (コスト削減)
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --min-instances 0

# ただし初回リクエストが遅くなる (コールドスタート)
```

### 2. CPU割り当て最適化

```bash
# リクエスト処理時のみCPU割り当て
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --cpu-throttling
```

### 3. コスト見積もり

```bash
# 料金計算機
# https://cloud.google.com/products/calculator

# 概算 (asia-northeast1):
# - vCPU: $0.00002400/vCPU-second
# - メモリ: $0.00000250/GiB-second
# - リクエスト: $0.40/100万リクエスト

# 例: 2vCPU, 2GiB, 常時1インスタンス稼働
# 月間コスト: 約 $50-80
```

---

## セキュリティ強化

### 1. 認証追加

```bash
# 認証必須化
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --no-allow-unauthenticated

# IAMポリシー設定
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --region ${REGION} \
  --member="user:your-email@example.com" \
  --role="roles/run.invoker"
```

### 2. VPC連携

```bash
# VPC Connector作成
gcloud compute networks vpc-access connectors create magi-ac-connector \
  --region ${REGION} \
  --range 10.8.0.0/28

# Cloud Run から VPC 経由でアクセス
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --vpc-connector magi-ac-connector
```

---

## 更新・ロールバック

### 更新

```bash
# 新バージョンデプロイ
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:v2.0.0 \
  --region ${REGION}
```

### ロールバック

```bash
# リビジョン一覧
gcloud run revisions list \
  --service ${SERVICE_NAME} \
  --region ${REGION}

# 特定リビジョンへロールバック
gcloud run services update-traffic ${SERVICE_NAME} \
  --region ${REGION} \
  --to-revisions REVISION_NAME=100
```

---

## デプロイチェックリスト

- [ ] GCPプロジェクト作成・設定
- [ ] 必要なAPI有効化
- [ ] サービスアカウント作成・権限付与
- [ ] Secret Manager にAPI keys保存
- [ ] Dockerfile作成
- [ ] .dockerignore 作成
- [ ] ヘルスチェックエンドポイント実装
- [ ] ローカルDocker動作確認
- [ ] Cloud Build でビルド
- [ ] Cloud Run にデプロイ
- [ ] BigQueryテーブル初期化
- [ ] デプロイ後動作確認
- [ ] ログ・監視設定
- [ ] カスタムドメイン設定 (オプション)
- [ ] CI/CD パイプライン設定 (オプション)
- [ ] 負荷テスト実施
- [ ] ドキュメント更新

---

## リソース

- [Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [Container Registry](https://cloud.google.com/container-registry)
- [Secret Manager](https://cloud.google.com/secret-manager)
- [BigQuery](https://cloud.google.com/bigquery)
- [Cloud Build](https://cloud.google.com/build)

---

## サポート

問題が発生した場合:
1. Cloud Logging でログ確認
2. Cloud Monitoring でメトリクス確認
3. GitHub Issues に報告
4. GCP サポートに連絡
