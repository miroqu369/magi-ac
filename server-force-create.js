'use strict';
const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const YahooFinanceCollector = require('./collectors/yahoo-finance');
const CompanyInfoCollector = require('./collectors/company-info');

const app = express();
const bq = new BigQuery({ projectId: 'screen-share-459802', location: 'asia-northeast1' });
const storage = new Storage();
const bucket = storage.bucket('magi-ac-data');
const dataset = bq.dataset('magi_ac');

app.use(express.json());

// テーブル初期化（起動時に実行）
async function initTable() {
  try {
    const table = dataset.table('stock_metrics_historical');
    const [exists] = await table.exists();
    
    if (!exists) {
      console.log('テーブル作成中: stock_metrics_historical');
      await table.create({
        schema: [
          { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
          { name: 'company_name', type: 'STRING', mode: 'NULLABLE' },
          { name: 'industry', type: 'STRING', mode: 'NULLABLE' },
          { name: 'sector', type: 'STRING', mode: 'NULLABLE' },
          { name: 'country', type: 'STRING', mode: 'NULLABLE' },
          { name: 'website', type: 'STRING', mode: 'NULLABLE' },
          { name: 'fetch_date', type: 'DATE', mode: 'REQUIRED' },
          { name: 'fetch_time', type: 'TIMESTAMP', mode: 'REQUIRED' },
          { name: 'price', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'per', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'eps', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'dividend_yield', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'market_cap', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'high_52w', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'low_52w', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'price_change_percent', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'data_source', type: 'STRING', mode: 'NULLABLE' },
          { name: 'raw_data', type: 'JSON', mode: 'NULLABLE' }
        ]
      });
      console.log('✅ テーブル作成完了');
    } else {
      console.log('テーブル既存: stock_metrics_historical');
    }
  } catch (error) {
    console.error('テーブル初期化エラー:', error);
  }
}

app.post('/api/fetch', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'ティッカーシンボルが必要です' });
    }

    console.log('[FETCH] 情報収集開始: ' + symbol);

    const companyInfoCollector = new CompanyInfoCollector();
    const companyInfo = await companyInfoCollector.getCompanyProfile(symbol);

    const yahooCollector = new YahooFinanceCollector();
    const financialData = await yahooCollector.getQuote(symbol);

    const mergedData = {
      ...financialData,
      ...companyInfo
    };

    await saveToBigQuery(mergedData);
    await saveToStorage(mergedData);

    console.log('[FETCH] 完了: ' + symbol);

    res.json({
      status: 'success',
      symbol: mergedData.symbol,
      company: mergedData.company_name,
      industry: mergedData.industry,
      country: mergedData.country,
      timestamp: mergedData.timestamp,
      financialData: {
        price: mergedData.financialData.currentPrice,
        per: mergedData.financialData.per,
        eps: mergedData.financialData.eps,
        dividendYield: mergedData.financialData.dividendYield,
        marketCap: mergedData.financialData.marketCap
      }
    });

  } catch (error) {
    console.error('[FETCH] エラー:', error);
    res.status(500).json({
      error: '情報取得に失敗しました',
      message: error.message
    });
  }
});

async function saveToBigQuery(data) {
  try {
    const table = dataset.table('stock_metrics_historical');
    const fd = data.financialData || {};
    
    const row = {
      symbol: data.symbol,
      company_name: data.company_name,
      industry: data.industry,
      sector: data.sector,
      country: data.country,
      website: data.website,
      fetch_date: data.fetchDate,
      fetch_time: data.timestamp,
      price: fd.currentPrice || null,
      per: fd.per || null,
      eps: fd.eps || null,
      dividend_yield: fd.dividendYield || null,
      market_cap: fd.marketCap || null,
      high_52w: fd.fiftyTwoWeekHigh || null,
      low_52w: fd.fiftyTwoWeekLow || null,
      price_change_percent: data.priceChange?.percent || null,
      data_source: 'yahoo-finance',
      raw_data: fd
    };

    await table.insert([row]);
    console.log('BQ保存: ' + data.symbol);
    
  } catch (error) {
    console.error('BQ保存エラー:', error);
  }
}

async function saveToStorage(data) {
  try {
    const filename = 'stock-data/' + data.symbol + '/' + data.fetchDate + '/' + Date.now() + '.json';
    const file = bucket.file(filename);
    await file.save(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Storage保存エラー:', error);
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 8080;
app.listen(port, async () => {
  console.log('Server listening on port ' + port);
  await initTable();
});

module.exports = app;
