#!/bin/bash

# MAGI AC Cloud Run デプロイスクリプト
# 作成日: 2025-11-28
# 実行場所: Google Cloud Shell

set -e  # エラーで停止

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🚀 MAGI AC デプロイ開始                                 ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 1. プロジェクト確認
echo "📋 Step 1: プロジェクト確認"
PROJECT_ID=$(gcloud config get-value project)
echo "   プロジェクトID: $PROJECT_ID"
echo ""

# 2. ブランチ切り替え
echo "📋 Step 2: 最新コードを取得"
if [ -d "magi-ac" ]; then
    cd magi-ac
    git fetch origin
    git checkout institutional-analysis
    git pull origin institutional-analysis
else
    git clone https://github.com/dogmaai/magi-ac.git
    cd magi-ac
    git checkout institutional-analysis
fi
echo "   ✅ institutional-analysis ブランチに切り替え完了"
echo ""

# 3. 依存関係確認
echo "📋 Step 3: package.json 確認"
if [ -f "package.json" ]; then
    echo "   ✅ package.json 存在確認"
else
    echo "   ❌ package.json が見つかりません"
    exit 1
fi
echo ""

# 4. .gcloudignore 作成（不要なファイルを除外）
echo "📋 Step 4: .gcloudignore 作成"
cat > .gcloudignore << 'EOF'
.git
.github
node_modules
*.log
*.md
test-*.sh
.env.local
.DS_Store
EOF
echo "   ✅ .gcloudignore 作成完了"
echo ""

# 5. Cloud Run デプロイ
echo "📋 Step 5: Cloud Run デプロイ実行"
echo "   リージョン: asia-northeast1"
echo "   サービス名: magi-ac"
echo ""

gcloud run deploy magi-ac \
  --source=. \
  --region=asia-northeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300s \
  --max-instances=10 \
  --set-env-vars="PORT=8888" \
  --quiet

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✅ デプロイ完了！                                       ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 6. サービスURL取得
echo "📋 Step 6: サービスURL確認"
SERVICE_URL=$(gcloud run services describe magi-ac --region=asia-northeast1 --format='value(status.url)')
echo "   URL: $SERVICE_URL"
echo ""

# 7. ヘルスチェック
echo "📋 Step 7: ヘルスチェック実行"
echo "   待機中（5秒）..."
sleep 5
curl -s "$SERVICE_URL/health" | jq .
echo ""

# 8. テスト実行
echo "📋 Step 8: APIテスト実行"
echo "   テスト: /api/analyze (AAPL)"
curl -s -X POST "$SERVICE_URL/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}' | jq '{symbol, company, consensus, ai_count: (.aiRecommendations | length)}'
echo ""

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🎉 すべて完了！                                         ║"
echo "║                                                           ║"
echo "║   サービスURL:                                            ║"
echo "║   $SERVICE_URL                      ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
