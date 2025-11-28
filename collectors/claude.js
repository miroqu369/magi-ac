import axios from 'axios';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export async function getClaudeRecommendation(stockData, symbol) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[CLAUDE] API key not configured');
      return null;
    }

    console.log(`[CLAUDE] Getting recommendation for ${symbol}`);

    const prompt = `あなたは人間的な視点を持つ投資アナリストです。以下の株式データを感情的・倫理的側面も含めて分析してください。

銘柄: ${symbol}
会社名: ${stockData.shortName || stockData.longName}
現在価格: $${stockData.regularMarketPrice}
前日終値: $${stockData.regularMarketPreviousClose}
時価総額: $${stockData.marketCap}
PER: ${stockData.trailingPE}
EPS: ${stockData.epsTrailingTwelveMonths}

以下のJSON形式で回答してください：
{
  "action": "BUY" | "HOLD" | "SELL",
  "confidence": 0.0-1.0の数値,
  "reasoning": "判断理由（簡潔に）"
}`;

    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const content = response.data.content[0].text;
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (e) {
      console.warn('[CLAUDE] JSON parse failed, using defaults');
      parsed = {
        action: 'HOLD',
        confidence: 0.5,
        reasoning: content.substring(0, 200)
      };
    }

    return {
      provider: 'claude',
      magi_unit: 'Unit-C3',
      role: '人間的分析',
      action: parsed.action || 'HOLD',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'Analysis completed'
    };

  } catch (error) {
    console.error('[CLAUDE] Recommendation failed:', error.message);
    return {
      provider: 'claude',
      magi_unit: 'Unit-C3',
      role: '人間的分析',
      action: 'HOLD',
      confidence: 0.5,
      reasoning: 'Error: ' + error.message
    };
  }
}
