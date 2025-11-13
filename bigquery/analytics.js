'use strict';
const { BigQuery } = require('@google-cloud/bigquery');

class Analytics {
  constructor() {
    this.bq = new BigQuery({ location: 'asia-northeast1' });
  }

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
      console.error('BigQuery error:', error.message);
      return null;
    }
  }

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
      return [];
    }
  }

  async getSymbolStats(symbol) {
    try {
      const query = `
        SELECT symbol, COUNT(*) as data_points
        FROM \`screen-share-459802.magi_ac.financials_raw\`
        WHERE symbol = @symbol
        GROUP BY symbol
      `;
      const [rows] = await this.bq.query({
        query,
        params: { symbol },
        location: 'asia-northeast1'
      });
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = Analytics;
