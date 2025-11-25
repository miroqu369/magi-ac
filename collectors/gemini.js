'use strict';
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiCollector {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  async analyze(symbol, financialData) {
    try {
      const prompt = `銘柄: ${symbol}
現在価格: $${financialData.currentPrice}
PER: ${financialData.per}
EPS: $${financialData.eps}
時価総額: $${financialData.marketCap}

論理的数値分析の視点から、この銘柄の投資判断を行ってください。
財務健全性、収益成長率、バリュエーションを重視してください。

以下の形式で回答してください：
{
  "action": "BUY/HOLD/SELL",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由を100文字以内"
}`;

      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);

      return {
        provider: 'gemini',
        magi_unit: 'Unit-M1',
        role: '論理的数値分析',
        action: parsed.action,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('[Gemini] 分析エラー:', error.message);
      return {
        provider: 'gemini',
        magi_unit: 'Unit-M1',
        role: '論理的数値分析',
        action: 'HOLD',
        confidence: 0.5,
        reasoning: '分析失敗: ' + error.message
      };
    }
  }
}

module.exports = GeminiCollector;
