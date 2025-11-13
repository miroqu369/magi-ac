const { BigQuery } = require('@google-cloud/bigquery');

class BigQueryStorage {
  constructor() {
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT || 'screen-share-459802'
    });
    this.dataset = this.bigquery.dataset('magi_ac');
  }

  // 分析結果を保存
  async saveAnalysis(data) {
    try {
      const analysisId = `${data.symbol}_${Date.now()}`;
      const timestamp = new BigQuery.timestamp(new Date());

      // 分析結果テーブルに挿入
      const analysisRow = {
        analysis_id: analysisId,
        symbol: data.symbol,
        company_name: data.company,
        analyzed_at: timestamp,
        stock_price: data.financialData.currentPrice || null,
        market_cap: data.financialData.marketCap || null,
        pe_ratio: data.financialData.pe || null,
        final_recommendation: this.extractRecommendation(data.analysis),
        final_analysis: data.analysis.substring(0, 5000) // 最大5000文字
      };

      await this.dataset.table('analyses').insert([analysisRow]);
      console.log(`✅ Analysis saved to BigQuery: ${analysisId}`);

      // AI判断テーブルに挿入
      if (data.aiRecommendations && data.aiRecommendations.length > 0) {
        const judgmentRows = data.aiRecommendations.map(ai => ({
          judgment_id: `${analysisId}_${ai.provider}`,
          analysis_id: analysisId,
          ai_provider: ai.provider,
          magi_unit: ai.magi_unit,
          action: ai.action,
          confidence: ai.confidence,
          reasoning: ai.text.substring(0, 5000),
          judged_at: timestamp
        }));

        await this.dataset.table('ai_judgments').insert(judgmentRows);
        console.log(`✅ ${judgmentRows.length} AI judgments saved to BigQuery`);
      }

      return analysisId;

    } catch (error) {
      console.error('BigQuery save error:', error);
      throw error;
    }
  }

  // 最終推奨を抽出
  extractRecommendation(text) {
    if (text.match(/推奨.*買い|判断.*買い/i)) return 'BUY';
    if (text.match(/推奨.*売り|判断.*売り/i)) return 'SELL';
    if (text.match(/推奨.*保有|判断.*保有/i)) return 'HOLD';
    return 'UNKNOWN';
  }

  // 分析履歴を取得
  async getAnalysisHistory(symbol, limit = 10) {
    const query = `
      SELECT 
        analysis_id,
        symbol,
        company_name,
        analyzed_at,
        stock_price,
        final_recommendation,
        final_analysis
      FROM \`screen-share-459802.magi_ac.analyses\`
      WHERE symbol = @symbol
      ORDER BY analyzed_at DESC
      LIMIT @limit
    `;

    const options = {
      query: query,
      params: { symbol: symbol, limit: limit }
    };

    const [rows] = await this.bigquery.query(options);
    return rows;
  }

  // AI判断の統計を取得
  async getAIStatistics(symbol) {
    const query = `
      SELECT 
        ai_provider,
        action,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence
      FROM \`screen-share-459802.magi_ac.ai_judgments\` aj
      JOIN \`screen-share-459802.magi_ac.analyses\` a
        ON aj.analysis_id = a.analysis_id
      WHERE a.symbol = @symbol
      GROUP BY ai_provider, action
      ORDER BY ai_provider, action
    `;

    const options = {
      query: query,
      params: { symbol: symbol }
    };

    const [rows] = await this.bigquery.query(options);
    return rows;
  }
}

module.exports = BigQueryStorage;
