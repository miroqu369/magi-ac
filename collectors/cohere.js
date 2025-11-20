import axios from 'axios';

const COHERE_API_URL = 'https://api.cohere.ai/v1';
const COHERE_API_KEY = process.env.COHERE_API_KEY;

/**
 * Cohere Document Analysis
 * Role: 文書解析・情報抽出専門AI (ISABEL)
 */

/**
 * テキストから財務情報を抽出
 */
export async function analyzeDocument(text, options = {}) {
  try {
    if (!COHERE_API_KEY) {
      console.warn('[COHERE] API key not configured');
      return null;
    }

    const documentType = options.documentType || 'general';
    
    console.log(`[COHERE] Analyzing ${documentType} document (${text.length} chars)`);

    // Cohere Chat API で文書解析
    const response = await axios.post(
      `${COHERE_API_URL}/chat`,
      {
        model: 'command-r-plus',
        message: buildAnalysisPrompt(text, documentType),
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const analysis = response.data.text;

    // JSON形式で構造化
    return parseAnalysis(analysis, documentType);

  } catch (error) {
    console.error('[COHERE] Document analysis failed:', error.message);
    return {
      error: true,
      message: error.message,
      analysis: null
    };
  }
}

/**
 * ニュース記事のセンチメント分析
 */
export async function analyzeSentiment(text, symbol) {
  try {
    if (!COHERE_API_KEY) {
      console.warn('[COHERE] API key not configured');
      return null;
    }

    console.log(`[COHERE] Sentiment analysis for ${symbol}`);

    const prompt = `以下のニュース記事について、${symbol}の株価への影響をセンチメント分析してください。

記事:
${text}

以下のJSON形式で回答:
{
  "sentiment": "positive" | "neutral" | "negative",
  "score": 0.0-1.0の数値,
  "impact": "high" | "medium" | "low",
  "summary": "影響の要約（日本語、50文字以内）",
  "key_factors": ["要因1", "要因2", "要因3"]
}`;

    const response = await axios.post(
      `${COHERE_API_URL}/chat`,
      {
        model: 'command-r',
        message: prompt,
        temperature: 0.2,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    // JSONパース
    const content = response.data.text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      sentiment: 'neutral',
      score: 0.5,
      impact: 'low',
      summary: content.substring(0, 50),
      key_factors: []
    };

  } catch (error) {
    console.error('[COHERE] Sentiment analysis failed:', error.message);
    return null;
  }
}

/**
 * 企業レポートの要約
 */
export async function summarizeReport(text, symbol, reportType = 'earnings') {
  try {
    if (!COHERE_API_KEY) {
      console.warn('[COHERE] API key not configured');
      return null;
    }

    console.log(`[COHERE] Summarizing ${reportType} report for ${symbol}`);

    const prompt = `${symbol}の${reportType === 'earnings' ? '決算' : '年次'}レポートを要約してください。

レポート内容:
${text.substring(0, 10000)}

以下の項目を抽出:
1. 重要な財務数値
2. 主要なハイライト
3. リスク要因
4. 今後の見通し

簡潔に日本語で回答してください。`;

    const response = await axios.post(
      `${COHERE_API_URL}/summarize`,
      {
        text: text,
        length: 'medium',
        format: 'bullets',
        model: 'command-r',
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return {
      summary: response.data.summary,
      reportType: reportType,
      symbol: symbol,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[COHERE] Report summarization failed:', error.message);
    return null;
  }
}

/**
 * RAG - 文書から質問に回答
 */
export async function queryDocument(documents, question) {
  try {
    if (!COHERE_API_KEY) {
      console.warn('[COHERE] API key not configured');
      return null;
    }

    console.log(`[COHERE] RAG query: ${question}`);

    const response = await axios.post(
      `${COHERE_API_URL}/chat`,
      {
        model: 'command-r-plus',
        message: question,
        documents: documents,
        temperature: 0.2,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    return {
      answer: response.data.text,
      citations: response.data.citations || [],
      documents_used: response.data.documents || []
    };

  } catch (error) {
    console.error('[COHERE] RAG query failed:', error.message);
    return null;
  }
}

// ===== Helper Functions =====

function buildAnalysisPrompt(text, documentType) {
  const prompts = {
    earnings: `以下は企業の決算資料です。重要な財務情報を抽出してください：

${text}

抽出項目：
- 売上高
- 営業利益
- 純利益
- EPS
- ガイダンス
- 主要セグメント別売上
- リスク要因`,

    news: `以下はニュース記事です。投資判断に関連する情報を抽出してください：

${text}

抽出項目：
- 主要トピック
- センチメント
- 投資インパクト
- リスク要因`,

    annual: `以下は年次レポートです。要点を抽出してください：

${text}

抽出項目：
- 業績サマリー
- 事業戦略
- リスク要因
- 今後の見通し`,

    general: `以下の文書を分析し、要点を抽出してください：

${text}`
  };

  return prompts[documentType] || prompts.general;
}

function parseAnalysis(analysisText, documentType) {
  try {
    // JSON形式を試みる
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // テキスト形式をパース
    return {
      type: documentType,
      content: analysisText,
      extracted_at: new Date().toISOString()
    };

  } catch (error) {
    console.warn('[COHERE] Analysis parsing failed, returning raw text');
    return {
      type: documentType,
      content: analysisText,
      extracted_at: new Date().toISOString()
    };
  }
}

export default {
  analyzeDocument,
  analyzeSentiment,
  summarizeReport,
  queryDocument
};
