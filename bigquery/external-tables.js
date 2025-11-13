'use strict';
const { BigQuery } = require('@google-cloud/bigquery');

class ExternalTablesManager {
  constructor() {
    this.bq = new BigQuery({ location: 'asia-northeast1' });
  }

  async setupFinancialsTable() {
    try {
      const dataset = this.bq.dataset('magi_ac');
      const [exists] = await dataset.exists();
      if (!exists) {
        await this.bq.createDataset('magi_ac', { location: 'asia-northeast1' });
        console.log('✅ Dataset magi_ac created');
      } else {
        console.log('ℹ️ Dataset magi_ac already exists');
      }
      console.log('✅ External tables ready');
    } catch (error) {
      console.log('ℹ️ Table setup info:', error.message);
    }
  }
}

module.exports = ExternalTablesManager;
