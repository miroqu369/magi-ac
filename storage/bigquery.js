import { BigQuery } from '@google-cloud/bigquery';

class BigQueryStorage {
  constructor() {
    this.bigquery = new BigQuery({
      projectId: process.env.GCP_PROJECT || 'screen-share-459802'
    });
    this.dataset = this.bigquery.dataset('magi_ac');
  }

  // 4AI合議結果を保存
  async saveConsensusAnalysis(symbol, technical, aiConsensus) {
    try {
      const analysisId = `${symbol}_${Date.now()}`;
      const timestamp = new Date().toISOString();

      // analyses テーブルに挿入
      const analysisRow = {
        analysis_id: analysisId,
        symbol: symbol.toUpperCase(),
        company_name: technical.company || '',
        analyzed_at: timestamp,
        stock_price: parseFloat(technical.currentPrice) || null,
        market_cap: null,
        pe_ratio: null,
        final_recommendation: aiConsensus.consensus.recommendation,
        final_analysis: JSON.stringify(aiConsensus.consensus)
      };

      await this.dataset.table('analyses').insert([analysisRow]);
      console.log(`[BigQuery] ✅ Analysis saved: ${analysisId}`);

      // ai_judgments テーブルに挿入
      const judgmentRows = aiConsensus.aiAnalysis
        .filter(ai => ai.action && !ai.error)
        .map(ai => ({
          judgment_id: `${analysisId}_${ai.provider}`,
          analysis_id: analysisId,
          ai_provider: ai.provider,
          magi_unit: ai.role || '',
          action: ai.action,
          confidence: ai.confidence || 0,
          reasoning: (ai.reasoning || '').substring(0, 5000),
          judged_at: timestamp
        }));

      if (judgmentRows.length > 0) {
        await this.dataset.table('ai_judgments').insert(judgmentRows);
        console.log(`[BigQuery] ✅ ${judgmentRows.length} AI judgments saved`);
      }

      return analysisId;
    } catch (error) {
      console.error('[BigQuery] Save error:', error.message);
      // エラーでもAPIは継続
      return null;
    }
  }

  // 分析履歴を取得
  async getAnalysisHistory(symbol, limit = 10) {
    try {
      const query = `
        SELECT 
          a.analysis_id,
          a.symbol,
          a.company_name,
          a.analyzed_at,
          a.stock_price,
          a.final_recommendation,
          a.final_analysis
        FROM \`screen-share-459802.magi_ac.analyses\` a
        WHERE a.symbol = @symbol
        ORDER BY a.analyzed_at DESC
        LIMIT @limit
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { symbol: symbol.toUpperCase(), limit }
      });

      return rows;
    } catch (error) {
      console.error('[BigQuery] Query error:', error.message);
      return [];
    }
  }

  // AI判断詳細を取得
  async getJudgmentDetails(analysisId) {
    try {
      const query = `
        SELECT *
        FROM \`screen-share-459802.magi_ac.ai_judgments\`
        WHERE analysis_id = @analysisId
        ORDER BY ai_provider
      `;

      const [rows] = await this.bigquery.query({
        query,
        params: { analysisId }
      });

      return rows;
    } catch (error) {
      console.error('[BigQuery] Query error:', error.message);
      return [];
    }
  }
}

export const bigQueryStorage = new BigQueryStorage();
