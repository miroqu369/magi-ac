const { Storage } = require('@google-cloud/storage');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

class DataLakeManager {
  constructor() {
    this.storage = new Storage();
    this.bigquery = new BigQuery();
    this.bucketName = 'magi-ac-data';
    this.bucket = this.storage.bucket(this.bucketName);
  }

  // 財務データを保存（JSON）
  async saveFinancialData(data) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      
      const gcsPath = `raw/financials/${year}/${month}/${data.symbol}_${timestamp}.json`;
      
      const file = this.bucket.file(gcsPath);
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        metadata: {
          symbol: data.symbol,
          savedAt: now.toISOString()
        }
      });

      console.log(`💾 Financial data saved: gs://${this.bucketName}/${gcsPath}`);
      
      return {
        gcsPath,
        publicUrl: `gs://${this.bucketName}/${gcsPath}`
      };

    } catch (error) {
      console.error('Save financial data error:', error);
      throw error;
    }
  }

  // AI応答を保存（JSON）
  async saveAIResponse(provider, data) {
    try {
      const timestamp = Date.now();
      const gcsPath = `raw/ai_responses/${provider}/${data.symbol}_${timestamp}.json`;
      
      const file = this.bucket.file(gcsPath);
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        metadata: {
          provider,
          symbol: data.symbol,
          savedAt: new Date().toISOString()
        }
      });

      console.log(`💾 AI response saved: gs://${this.bucketName}/${gcsPath}`);
      
      return `gs://${this.bucketName}/${gcsPath}`;

    } catch (error) {
      console.error('Save AI response error:', error);
      throw error;
    }
  }

  // PDFを保存
  async savePDF(localPath, symbol, documentType = 'earnings') {
    try {
      const fileName = path.basename(localPath);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      const gcsPath = `raw/pdfs/${documentType}/${symbol}/${year}/${month}/${fileName}`;
      
      await this.bucket.upload(localPath, {
        destination: gcsPath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            symbol,
            documentType,
            uploadedAt: now.toISOString()
          }
        }
      });

      console.log(`💾 PDF saved: gs://${this.bucketName}/${gcsPath}`);
      
      return `gs://${this.bucketName}/${gcsPath}`;

    } catch (error) {
      console.error('Save PDF error:', error);
      throw error;
    }
  }

  // BigQuery External Tableを作成
  async createExternalTable() {
    try {
      const dataset = this.bigquery.dataset('magi_ac');
      
      // External Table定義
      const tableId = 'raw_financials';
      const schema = [
        { name: 'symbol', type: 'STRING' },
        { name: 'company', type: 'STRING' },
        { name: 'financialData', type: 'JSON' },
        { name: 'timestamp', type: 'TIMESTAMP' }
      ];

      const options = {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        sourceUris: [`gs://${this.bucketName}/raw/financials/*/*.json`],
        autodetect: true,
        schema: { fields: schema }
      };

      const [table] = await dataset.createTable(tableId, options);
      console.log(`✅ External table created: ${table.id}`);
      
      return table;

    } catch (error) {
      if (error.code === 409) {
        console.log('ℹ️ External table already exists');
      } else {
        console.error('Create external table error:', error);
        throw error;
      }
    }
  }

  // BigQueryでクエリ実行
  async query(sql) {
    try {
      const [rows] = await this.bigquery.query(sql);
      return rows;
    } catch (error) {
      console.error('BigQuery query error:', error);
      throw error;
    }
  }
}

module.exports = DataLakeManager;
