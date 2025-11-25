'use strict';
const axios = require('axios');

class GrokCollector {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.x.ai/v1';
  }

  async analyze(symbol, financialData) {
    try {
      const prompt = `銘柄: ${symbol}
現在価格: $${financialData.currentPrice}
PER: ${financialData.per}
EPS: $${financialData.eps}
時価総額: $${financialData.marketCap}

創造的トレンド分析の視点から、この銘柄の投資判断を行ってください。
イノベーション力、新興市場の可能性、ゲームチェンジャー要素を重視してください。

以下の形式で回答してください：
{
  "action": "BUY/HOLD/SELL",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由を100文字以内"
}`;

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'grok-2-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5
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
        provider: 'grok',
        magi_unit: 'Unit-B2',
        role: '創造的トレンド分析',
        action: parsed.action,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('[Grok] 分析エラー:', error.message);
      return {
        provider: 'grok',
        magi_unit: 'Unit-B2',
        role: '創造的トレンド分析',
        action: 'HOLD',
        confidence: 0.5,
        reasoning: '分析失敗: ' + error.message
      };
    }
  }
}

module.exports = GrokCollector;
