import axios from 'axios';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

export async function getGrokRecommendation(stockData, symbol) {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      console.warn('[GROK] API key not configured');
      return null;
    }

    console.log(`[GROK] Getting recommendation for ${symbol}`);

    const prompt = `あなたは革新的な投資アナリストです。以下の株式データを創造的に分析してください。

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
      GROK_API_URL,
      {
        model: 'grok-2-latest',
        messages: [
          {
            role: 'system',
            content: '創造的・革新的な視点で投資判断を行うアナリストです。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const content = response.data.choices[0].message.content;
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (e) {
      console.warn('[GROK] JSON parse failed, using defaults');
      parsed = {
        action: 'HOLD',
        confidence: 0.5,
        reasoning: content.substring(0, 200)
      };
    }

    return {
      provider: 'grok',
      magi_unit: 'Unit-B2',
      role: '創造的分析',
      action: parsed.action || 'HOLD',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'Analysis completed'
    };

  } catch (error) {
    console.error('[GROK] Recommendation failed:', error.message);
    return {
      provider: 'grok',
      magi_unit: 'Unit-B2',
      role: '創造的分析',
      action: 'HOLD',
      confidence: 0.5,
      reasoning: 'Error: ' + error.message
    };
  }
}
