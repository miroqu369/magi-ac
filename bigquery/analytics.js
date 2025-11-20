import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const DATASET_ID = 'magi_ac';
const TABLE_ID = 'financials_raw';

export async function queryLatestPrice(symbol) {
  const query = `
    SELECT 
      symbol,
      company,
      timestamp,
      financialData.currentPrice as currentPrice,
      financialData.marketCap as marketCap
    FROM \`${DATASET_ID}.${TABLE_ID}\`
    WHERE symbol = @symbol
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  const options = {
    query,
    params: { symbol }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows[0] || null;
  } catch (error) {
    console.error('[BIGQUERY] Query failed:', error.message);
    throw error;
  }
}

export async function queryPriceHistory(symbol, days = 30) {
  const query = `
    SELECT 
      symbol,
      timestamp,
      financialData.currentPrice as currentPrice,
      financialData.previousClose as previousClose,
      financialData.marketCap as marketCap
    FROM \`${DATASET_ID}.${TABLE_ID}\`
    WHERE symbol = @symbol
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    ORDER BY timestamp DESC
  `;

  const options = {
    query,
    params: { symbol, days }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows;
  } catch (error) {
    console.error('[BIGQUERY] History query failed:', error.message);
    throw error;
  }
}

export async function queryStats(symbol) {
  const query = `
    SELECT 
      symbol,
      COUNT(*) as data_points,
      AVG(financialData.currentPrice) as avg_price,
      MIN(financialData.currentPrice) as min_price,
      MAX(financialData.currentPrice) as max_price,
      AVG(financialData.marketCap) as avg_market_cap
    FROM \`${DATASET_ID}.${TABLE_ID}\`
    WHERE symbol = @symbol
    GROUP BY symbol
  `;

  const options = {
    query,
    params: { symbol }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows[0] || null;
  } catch (error) {
    console.error('[BIGQUERY] Stats query failed:', error.message);
    throw error;
  }
}

export async function createExternalTable() {
  try {
    const dataset = bigquery.dataset(DATASET_ID);
    
    // Check if dataset exists, create if not
    try {
      await dataset.get();
      console.log(`[BIGQUERY] Dataset ${DATASET_ID} already exists`);
    } catch (error) {
      console.log(`[BIGQUERY] Creating dataset ${DATASET_ID}`);
      await bigquery.createDataset(DATASET_ID);
    }

    // Define external table schema
    const tableConfig = {
      schema: {
        fields: [
          { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
          { name: 'company', type: 'STRING' },
          { name: 'timestamp', type: 'TIMESTAMP' },
          {
            name: 'financialData',
            type: 'RECORD',
            fields: [
              { name: 'currentPrice', type: 'FLOAT64' },
              { name: 'previousClose', type: 'FLOAT64' },
              { name: 'marketCap', type: 'INT64' },
              { name: 'pe', type: 'FLOAT64' },
              { name: 'eps', type: 'FLOAT64' },
              { name: 'revenue', type: 'INT64' },
              { name: 'profitMargin', type: 'FLOAT64' },
              { name: 'debtToEquity', type: 'FLOAT64' }
            ]
          },
          {
            name: 'aiRecommendations',
            type: 'RECORD',
            mode: 'REPEATED',
            fields: [
              { name: 'provider', type: 'STRING' },
              { name: 'action', type: 'STRING' },
              { name: 'confidence', type: 'FLOAT64' }
            ]
          }
        ]
      },
      externalDataConfiguration: {
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        sourceUris: ['gs://magi-ac-data/raw/financials/*.json'],
        autodetect: false
      }
    };

    const table = dataset.table(TABLE_ID);
    
    try {
      await table.get();
      console.log(`[BIGQUERY] Table ${TABLE_ID} already exists`);
      await table.setMetadata(tableConfig);
      console.log(`[BIGQUERY] Table ${TABLE_ID} updated`);
    } catch (error) {
      console.log(`[BIGQUERY] Creating table ${TABLE_ID}`);
      await dataset.createTable(TABLE_ID, tableConfig);
      console.log(`[BIGQUERY] Table ${TABLE_ID} created successfully`);
    }

    return true;

  } catch (error) {
    console.error('[BIGQUERY] External table creation failed:', error.message);
    throw error;
  }
}
