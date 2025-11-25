'use strict';
const { BigQuery } = require('@google-cloud/bigquery');

class Analytics {
  constructor() {
    this.bq = new BigQuery({ 
      projectId: 'screen-share-459802',
      location: 'asia-northeast1' 
    });
    this.dataset = this.bq.dataset('magi_ac');
  }

  // 財務データを保存
  async saveFinancialData(data) {
    try {
      const table = this.dataset.table('financials_raw');
      const rows = [{
        symbol: data.symbol,
        company: data.company,
        timestamp: new Date().toISOString(),
        fetchDate: data.fetchDate,
        currentPrice: data.financialData.currentPrice,
        previousClose: data.financialData.previousClose,
        per: data.financialData.per,
        eps: data.financialData.eps,
        dividendYield: data.financialData.dividendYield,
        marketCap: data.financialData.marketCap,
        fiftyTwoWeekHigh: data.financialData.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: data.financialData.fiftyTwoWeekLow,
        currency: data.financialData.currency,
        volume: data.financialData.volume || 0
      }];

      await table.insert(rows);
      console.log('[BigQuery] 財務データ保存成功:', data.symbol);
      return true;
    } catch (error) {
      console.error('[BigQuery] 財務データ保存失敗:', error.message);
      return false;
    }
  }

  // AI分析結果を保存
  async saveAIRecommendations(symbol, recommendations) {
    try {
      const table = this.dataset.table('ai_recommendations');
      const timestamp = new Date().toISOString();
      
      const rows = recommendations.map(rec => ({
        symbol: symbol,
        timestamp: timestamp,
        provider: rec.provider,
        magi_unit: rec.magi_unit,
        role: rec.role,
        action: rec.action,
        confidence: rec.confidence,
        reasoning: rec.reasoning
      }));

      await table.insert(rows);
      console.log('[BigQuery] AI分析結果保存成功:', symbol, `(${rows.length}件)`);
      return true;
    } catch (error) {
      console.error('[BigQuery] AI分析結果保存失敗:', error.message);
      return false;
    }
  }

  // 最新価格取得
  async getLatestPrice(symbol) {
    try {
      const query = `
        SELECT * FROM \`screen-share-459802.magi_ac.financials_raw\`
        WHERE symbol = @symbol
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      const options = {
        query,
        params: { symbol },
        location: 'asia-northeast1'
      };
      const [rows] = await this.bq.query(options);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('[BigQuery] 最新価格取得失敗:', error.message);
      return null;
    }
  }

  // 価格履歴取得
  async getPriceHistory(symbol, days = 30) {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const query = `
        SELECT * FROM \`screen-share-459802.magi_ac.financials_raw\`
        WHERE symbol = @symbol AND timestamp >= @cutoff
        ORDER BY timestamp ASC
      `;
      const [rows] = await this.bq.query({
        query,
        params: { symbol, cutoff: cutoffDate },
        location: 'asia-northeast1'
      });
      return rows;
    } catch (error) {
      console.error('[BigQuery] 価格履歴取得失敗:', error.message);
      return [];
    }
  }

  // 統計情報取得
  async getStats(symbol) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_records,
          MIN(currentPrice) as min_price,
          MAX(currentPrice) as max_price,
          AVG(currentPrice) as avg_price,
          MIN(timestamp) as first_fetch,
          MAX(timestamp) as last_fetch
        FROM \`screen-share-459802.magi_ac.financials_raw\`
        WHERE symbol = @symbol
      `;
      const [rows] = await this.bq.query({
        query,
        params: { symbol },
        location: 'asia-northeast1'
      });
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('[BigQuery] 統計情報取得失敗:', error.message);
      return null;
    }
  }
}

module.exports = Analytics;
