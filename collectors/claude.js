'use strict';
const Anthropic = require('@anthropic-ai/sdk');

class ClaudeCollector {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(symbol, financialData) {
    try {
      const prompt = `銘柄: ${symbol}
現在価格: $${financialData.currentPrice}
PER: ${financialData.per}
EPS: $${financialData.eps}
時価総額: $${financialData.marketCap}

人間的価値分析の視点から、この銘柄の投資判断を行ってください。
ブランド価値、企業文化、ESG、長期持続可能性を重視してください。

以下の形式で回答してください：
{
  "action": "BUY/HOLD/SELL",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由を100文字以内"
}`;

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = message.content[0].text;
      const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)[0]);

      return {
        provider: 'claude',
        magi_unit: 'Unit-C3',
        role: '人間的価値分析',
        action: parsed.action,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('[Claude] 分析エラー:', error.message);
      return {
        provider: 'claude',
        magi_unit: 'Unit-C3',
        role: '人間的価値分析',
        action: 'HOLD',
        confidence: 0.5,
        reasoning: '分析失敗: ' + error.message
      };
    }
  }
}

module.exports = ClaudeCollector;
