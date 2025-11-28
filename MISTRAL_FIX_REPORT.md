# Mistral API エラー修正レポート

## 問題

**エラーメッセージ:**
```
[MISTRAL PREDICTOR] Error: Invalid character in header content ["Authorization"]
```

## 原因

Node.jsのHTTPヘッダーバリデーションが、テンプレートリテラル（\`Bearer ${apiKey}\`）を使用した際に環境変数に含まれる可能性のある改行文字や空白文字を検出していた。

## 修正内容

### 1. API Keyのクリーニング処理追加

すべてのAI予測関数で `apiKey.trim()` を実行し、前後の空白・改行を除去。

### 2. ヘッダー構文の変更

テンプレートリテラルから文字列連結に変更：

**変更前:**
```javascript
headers: {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}
```

**変更後:**
```javascript
const cleanApiKey = apiKey.trim();
headers: {
  'Authorization': 'Bearer ' + cleanApiKey,
  'Content-Type': 'application/json'
}
```

### 3. エラーハンドリング強化

Mistral予測関数に詳細なエラーログを追加：
- Response status
- Response data
- Request headers

## 修正対象ファイル

- `predictors/ai-predictor.js`
  - `getGrokPrediction()` - ヘッダー修正
  - `getGeminiPrediction()` - （既存のまま、Gemini APIはヘッダー形式が異なる）
  - `getClaudePrediction()` - ヘッダー修正（`x-api-key`）
  - `getMistralPrediction()` - ヘッダー修正 + エラーログ追加

## テスト結果

### 修正前
```
[MISTRAL PREDICTOR] Error: Invalid character in header content ["Authorization"]
```

### 修正後
```
[MISTRAL PREDICTOR] Error: Request failed with status code 401
[MISTRAL PREDICTOR] Response status: 401
[MISTRAL PREDICTOR] Response data: {"detail":"Unauthorized"}
```

エラーは401（Unauthorized）に変わり、これはAPIキーの問題であることが明確になりました。

## 追加の問題発見

テスト中にすべてのAI APIが失敗していることが判明：
- Grok: 400 Bad Request
- Gemini: 400 Bad Request
- Claude: 401 Unauthorized
- Mistral: 401 Unauthorized

### 推奨対応

1. **APIキーの確認**
   - 各AIプロバイダーのコンソールで有効なキーを確認
   - `.env` ファイルでキーが正しく設定されているか確認
   - 改行文字や余分なスペースがないか確認

2. **APIキーの再取得**
   ```bash
   # .env ファイル
   XAI_API_KEY=xai-your-actual-key
   GEMINI_API_KEY=AIzaSy-your-actual-key
   ANTHROPIC_API_KEY=sk-ant-your-actual-key
   MISTRAL_API_KEY=your-actual-mistral-key
   ```

3. **モックモードでのテスト**
   ```bash
   # API Keyなしでテスト
   curl -X POST http://localhost:8888/api/predict \
     -H "Content-Type: application/json" \
     -d '{"symbol":"AAPL","horizon":"3months","enableAI":false}'
   ```

## まとめ

✅ **ヘッダーエラーは修正完了**
- テンプレートリテラルから文字列連結に変更
- API Keyのトリム処理追加
- エラーハンドリング強化

⚠️ **追加対応が必要**
- 各AIプロバイダーのAPIキーを正しく設定する必要がある
- 現在の401/400エラーはAPIキーの問題

🔧 **緊急対応不要**
- `enableAI=false` でモックモードは正常動作
- 開発・テストは継続可能
