const fetch = require('node-fetch');

class MagiClient {
  constructor(magiUrl, token) {
    this.magiUrl = magiUrl || 'https://magi-app-398890937507.asia-northeast1.run.app';
    this.token = token;
  }

  async analyze(prompt, mode = 'integration') {
    try {
      const response = await fetch(`${this.magiUrl}/api/consensus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          prompt,
          meta: { mode, temperature: 0.2 }
        })
      });

      if (!response.ok) {
        throw new Error(`MAGI API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MAGI Client error:', error);
      throw error;
    }
  }

  buildAnalysisPrompt(symbol, financialData) {
    const { company, currentPrice, currency, marketCap, pe, eps, revenue, profitMargin, debtToEquity } = financialData;
    
    return `
あなたは中立的な金融アナリストです。以下の企業の財務データを分析し、客観的な株価評価を提供してください。

企業名: ${company}
ティッカー: ${symbol}
現在株価: ${currentPrice} ${currency}
時価総額: ${marketCap ? (marketCap / 1e9).toFixed(2) + 'B' : 'N/A'}
PER: ${pe || 'N/A'}
EPS: ${eps || 'N/A'}
売上高: ${revenue ? (revenue / 1e9).toFixed(2) + 'B' : 'N/A'}
利益率: ${profitMargin ? (profitMargin * 100).toFixed(2) + '%' : 'N/A'}
負債比率: ${debtToEquity || 'N/A'}

以下の観点から分析してください：
1. 財務健全性（収益性、負債状況）
2. バリュエーション（PER、PBRなどの妥当性）
3. 成長性の見通し
4. リスク要因
5. **投資推奨と確信度**

**重要: 最後に必ず以下の形式で投資判断を明記してください:**

【投資判断】
判断: 買い/保有/売り のいずれか
確信度: 0-100%の数値
理由: 簡潔な理由

必ず中立的な視点で、根拠を明確にして回答してください。
    `.trim();
  }

  // 各AIの回答から判断を抽出
  extractRecommendation(text) {
    const recommendation = {
      action: 'HOLD', // BUY, HOLD, SELL
      confidence: 50,
      reason: ''
    };

    // 「買い」「保有」「売り」を検出
    if (text.match(/買い|BUY|購入|投資推奨.*買い/i)) {
      recommendation.action = 'BUY';
      recommendation.confidence = 70;
    } else if (text.match(/売り|SELL|売却|投資推奨.*売り/i)) {
      recommendation.action = 'SELL';
      recommendation.confidence = 70;
    } else if (text.match(/保有|HOLD|維持|投資推奨.*保有/i)) {
      recommendation.action = 'HOLD';
      recommendation.confidence = 60;
    }

    // 確信度を抽出（数値%がある場合）
    const confidenceMatch = text.match(/確信度[：:]\s*(\d+)\s*%/i);
    if (confidenceMatch) {
      recommendation.confidence = parseInt(confidenceMatch[1]);
    }

    // 強い表現があれば確信度を上げる
    if (text.match(/強く.*推奨|強力|明確に.*買い|非常に/i)) {
      recommendation.confidence = Math.min(90, recommendation.confidence + 15);
    }

    // 弱い表現があれば確信度を下げる
    if (text.match(/慎重に|リスクあり|不確実|様子を見る/i)) {
      recommendation.confidence = Math.max(40, recommendation.confidence - 10);
    }

    return recommendation;
  }
}

module.exports = MagiClient;
