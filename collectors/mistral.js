import axios from 'axios';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

export async function getMistralRecommendation(stockData, symbol) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.warn('[MISTRAL] API key not configured');
      return null;
    }

    console.log(`[MISTRAL] Getting recommendation for ${symbol}`);

    const prompt = `あなたは投資アナリストです。以下の株式データを分析し、投資判断を提供してください。

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
      MISTRAL_API_URL,
      {
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: '投資判断を行う実践的なアナリストとして、データに基づいた分析を提供してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
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
    
    // JSONパース
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (e) {
      console.warn('[MISTRAL] JSON parse failed, using defaults');
      parsed = {
        action: 'HOLD',
        confidence: 0.5,
        reasoning: content.substring(0, 200)
      };
    }

    return {
      provider: 'mistral',
      magi_unit: 'Unit-R4',
      role: '実践的分析',
      action: parsed.action || 'HOLD',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'Analysis completed'
    };

  } catch (error) {
    console.error('[MISTRAL] Recommendation failed:', error.message);
    return {
      provider: 'mistral',
      magi_unit: 'Unit-R4',
      role: '実践的分析',
      action: 'HOLD',
      confidence: 0.5,
      reasoning: 'Error: ' + error.message
    };
  }
}

export async function getMistralAnalysis(prompt) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY not configured');
    }

    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return response.data.choices[0].message.content;

  } catch (error) {
    console.error('[MISTRAL] Analysis failed:', error.message);
    throw error;
  }
}
