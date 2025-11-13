const fetch = require('node-fetch');

class GrokSummarizer {
  constructor() {
    this.apiKey = process.env.XAI_API_KEY;
    this.baseUrl = 'https://api.x.ai/v1';
    
    if (!this.apiKey) {
      throw new Error('XAI_API_KEY is not set');
    }
    
    console.log('✅ Grok Summarizer initialized');
  }

  // 大量のテキストを要約
  async summarize(text, context = '') {
    try {
      console.log(`📝 Grok要約開始: ${text.length}文字`);
      
      // テキストが長すぎる場合は分割
      const maxLength = 10000;
      const truncatedText = text.length > maxLength 
        ? text.substring(0, maxLength) + '...(省略)' 
        : text;
      
      const prompt = `
以下の情報を簡潔に要約してください。株式分析に必要な重要ポイントのみを抽出してください。

【コンテキスト】
${context}

【情報】
${truncatedText}

【要約形式】
- 重要な財務情報・数値
- 経営戦略やビジョン
- 成長要因・強み
- リスク要因・懸念点
- その他の注目ポイント

簡潔に、箇条書きで要約してください（500文字以内）。
      `.trim();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content || '';
      
      console.log(`✅ Grok要約完了: ${summary.length}文字`);
      
      return summary;
      
    } catch (error) {
      console.error('❌ Grok要約エラー:', error.message);
      throw error;
    }
  }

  // PDFのOCR・画像分析（Grok Vision）
  async analyzeDocument(imageBase64, filename, mimeType = 'image/png') {
    try {
      console.log(`🔍 Grok Vision分析開始: ${filename}`);
      
      const prompt = `
この財務諸表/決算資料を詳細に分析してください。

【抽出項目】
1. 文書の種類（決算短信、有価証券報告書、IR資料など）
2. 企業名・期間
3. 主要な財務数値
   - 売上高、営業利益、純利益
   - 総資産、純資産、負債
   - 1株あたり利益（EPS）
   - 配当
4. 前期比の増減率（%）
5. 経営の重要トピックス
6. リスク要因・注意点

日本語で、構造化された形式で詳しく回答してください。
      `.trim();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-vision-beta',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok Vision error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content || '';
      
      console.log(`✅ Grok Vision分析完了: ${analysis.length}文字`);
      
      return {
        filename,
        analysis,
        model: 'grok-vision-beta',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Grok Vision エラー:', error.message);
      throw error;
    }
  }

  // 複数情報源の統合要約
  async synthesize(sources, symbol, company) {
    try {
      console.log(`🔄 Grok統合分析: ${sources.length}件のソース`);
      
      const combinedText = sources
        .map((s, i) => `【ソース${i + 1}: ${s.source}】\n${s.content}`)
        .join('\n\n---\n\n');
      
      const prompt = `
企業「${company}」（ティッカー: ${symbol}）に関する以下の情報を統合して、投資判断に必要な重要ポイントを抽出してください。

${combinedText}

【統合要約形式】
1. 財務状況の概要
2. ビジネスモデル・強み
3. 成長戦略
4. リスク・懸念事項
5. 市場評価・アナリスト見解

簡潔に、箇条書きで要約してください（1000文字以内）。
      `.trim();

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const synthesis = data.choices?.[0]?.message?.content || '';
      
      console.log(`✅ Grok統合完了: ${synthesis.length}文字`);
      
      return synthesis;
      
    } catch (error) {
      console.error('❌ Grok統合エラー:', error.message);
      throw error;
    }
  }
}

module.exports = GrokSummarizer;
