import axios from 'axios';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function getGeminiRecommendation(stockData, symbol) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GEMINI] API key not configured');
      return null;
    }

    console.log(`[GEMINI] Getting recommendation for ${symbol}`);

    const prompt = `あなたは論理的な投資アナリストです。以下の株式データを科学的に分析してください。

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
      `${GEMINI_API_BASE}/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (e) {
      console.warn('[GEMINI] JSON parse failed, using defaults');
      parsed = {
        action: 'HOLD',
        confidence: 0.5,
        reasoning: content.substring(0, 200)
      };
    }

    return {
      provider: 'gemini',
      magi_unit: 'Unit-M1',
      role: '論理的分析',
      action: parsed.action || 'HOLD',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'Analysis completed'
    };

  } catch (error) {
    console.error('[GEMINI] Recommendation failed:', error.message);
    return {
      provider: 'gemini',
      magi_unit: 'Unit-M1',
      role: '論理的分析',
      action: 'HOLD',
      confidence: 0.5,
      reasoning: 'Error: ' + error.message
    };
  }
}
