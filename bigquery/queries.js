const { BigQuery } = require('@google-cloud/bigquery');

class AnalyticsQueries {
  constructor() {
    this.bq = new BigQuery();
  }

  async getLatestPrice(symbol) {
    const query = `
      SELECT 
        symbol,
        JSON_VALUE(financialData, '$.currentPrice') as price,
        JSON_VALUE(financialData, '$.pe') as pe_ratio,
        timestamp
      FROM \`screen-share-459802.magi_ac.financials_raw\`
      WHERE symbol = @symbol
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    
    try {
      const [rows] = await this.bq.query({ query, params: { symbol } });
      return rows[0] || null;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async getPriceHistory(symbol, days = 30) {
    const query = `
      SELECT 
        symbol,
        JSON_VALUE(financialData, '$.currentPrice') as price,
        JSON_VALUE(financialData, '$.pe') as pe_ratio,
        timestamp
      FROM \`screen-share-459802.magi_ac.financials_raw\`
      WHERE symbol = @symbol
        AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
      ORDER BY timestamp ASC
    `;
    
    try {
      const [rows] = await this.bq.query({ query, params: { symbol, days } });
      return rows;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async getSymbolStats(symbol) {
    const query = `
      SELECT 
        COUNT(*) as analysis_count,
        MIN(timestamp) as first_analysis,
        MAX(timestamp) as last_analysis,
        AVG(CAST(JSON_VALUE(financialData, '$.currentPrice') AS FLOAT64)) as avg_price
      FROM \`screen-share-459802.magi_ac.financials_raw\`
      WHERE symbol = @symbol
    `;
    
    try {
      const [rows] = await this.bq.query({ query, params: { symbol } });
      return rows[0] || null;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsQueries;
