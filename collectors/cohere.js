import { CohereClient } from 'cohere-ai';

/**
 * Cohere Document Analysis Collector
 * ISABEL - 文書解析・情報抽出AI
 */

// 遅延初期化
let cohere = null;

function getCohere() {
  if (!cohere) {
    cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
  }
  return cohere;
}

/**
 * 決算書から財務数値を抽出
 */
export async function extractFinancials(documentText, symbol) {
  try {
    const client = getCohere();
    
    const prompt = `以下は${symbol}の決算報告書の一部です。以下の財務数値を抽出してJSON形式で出力してください：

- 売上高 (revenue)
- 営業利益 (operating_income)
- 純利益 (net_income)
- EPS (earnings_per_share)
- 総資産 (total_assets)
- 負債総額 (total_liabilities)
- 株主資本 (shareholders_equity)

数値が見つからない場合はnullとしてください。

決算書:
${documentText.substring(0, 3000)}

JSON形式で出力（他の説明は不要）:`;

    const response = await client.chat({
      model: 'command-r-08-2024',
      message: prompt,
      temperature: 0.1,
    });

    const content = response.text;
    
    // JSON抽出（マークダウンコードブロックを除去）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const financials = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        symbol,
        financials,
        extracted_at: new Date().toISOString()
      };
    }

    throw new Error('Failed to extract JSON from response');
  } catch (error) {
    console.error('Cohere extractFinancials error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ニュース・レポートのセンチメント分析
 */
export async function analyzeSentiment(text, symbol) {
  try {
    const client = getCohere();
    
    const prompt = `以下は${symbol}に関するニュース記事またはレポートです。
この内容のセンチメント（ポジティブ/ネガティブ/ニュートラル）を分析し、
投資判断への影響を評価してください。

テキスト:
${text.substring(0, 2000)}

以下のJSON形式で出力してください:
{
  "sentiment": "positive/negative/neutral",
  "score": 0.0-1.0の数値,
  "impact": "high/medium/low",
  "summary": "簡潔な要約（100文字以内）",
  "key_factors": ["要因1", "要因2", "要因3"]
}`;

    const response = await client.chat({
      model: 'command-r-08-2024',
      message: prompt,
      temperature: 0.3,
    });

    const content = response.text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const sentiment = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        symbol,
        sentiment,
        analyzed_at: new Date().toISOString()
      };
    }

    throw new Error('Failed to extract JSON from response');
  } catch (error) {
    console.error('Cohere analyzeSentiment error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 長文レポートの要約
 */
export async function summarizeDocument(documentText, symbol) {
  try {
    const client = getCohere();
    
    const response = await client.chat({
      model: 'command-r-08-2024',
      message: `以下は${symbol}の決算報告書またはIR資料です。
重要なポイントを3-5点に要約してください。

文書:
${documentText.substring(0, 5000)}

要約（箇条書き）:`,
      temperature: 0.3,
    });

    return {
      success: true,
      symbol,
      summary: response.text,
      summarized_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Cohere summarizeDocument error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  extractFinancials,
  analyzeSentiment,
  summarizeDocument
};
