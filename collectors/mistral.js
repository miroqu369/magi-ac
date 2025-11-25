'use strict';
const axios = require('axios');

class MistralCollector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.mistral.ai/v1';
  }

  async analyze(symbol, financialData) {
    try {
      const prompt = `銘柄: ${symbol}
現在価格: $${financialData.currentPrice}
PER: ${financialData.per}
EPS: $${financialData.eps}
時価総額: $${financialData.marketCap}

実践的リスク分析の視点から、この銘柄の投資判断を行ってください。
リスク・リターン、ボラティリティ、ポートフォリオ適合性を重視してください。

以下の形式で回答してください：
{
  "action": "BUY/HOLD/SELL",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由を100文字以内"
}`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'mistral-large-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);

      return {
        provider: 'mistral',
        magi_unit: 'Unit-R4',
        role: '実践的リスク分析',
        action: parsed.action,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('[Mistral] 分析エラー:', error.message);
      return {
        provider: 'mistral',
        magi_unit: 'Unit-R4',
        role: '実践的リスク分析',
        action: 'HOLD',
        confidence: 0.5,
        reasoning: '分析失敗: ' + error.message
      };
    }
  }
}

module.exports = MistralCollector;
