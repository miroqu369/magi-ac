'use strict';
const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const YahooFinanceCollector = require('./collectors/yahoo-finance');

const app = express();
const PORT = Number(process.env.PORT) || 8080;

const bq = new BigQuery({ projectId: 'screen-share-459802', location: 'asia-northeast1' });
const storage = new Storage();
const bucket = storage.bucket('magi-ac-data');
const dataset = bq.dataset('magi_ac');

app.use(express.json());
app.use(express.static('public'));

// ティッカー検索 API
app.post('/api/fetch', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'ティッカーシンボルが必要です' });
    }

    console.log('[FETCH] 情報収集開始: ' + symbol);

    const collector = new YahooFinanceCollector();
    const financialData = await collector.getQuote(symbol);

    await saveToBigQuery(financialData);
    await saveToStorage(financialData);

    console.log('[FETCH] 完了: ' + symbol);

    res.json({
      status: 'success',
      symbol: financialData.symbol,
      company: financialData.company,
      timestamp: financialData.timestamp,
      data: financialData.financialData,
      priceChange: financialData.priceChange
    });

  } catch (error) {
    console.error('[FETCH] エラー:', error);
    res.status(500).json({
      error: '情報取得に失敗しました',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 複数ティッカー一括取得
app.post('/api/fetch-multiple', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: 'symbols 配列が必要です' });
    }

    console.log('[FETCH-MULTIPLE] ' + symbols.length + '個の銘柄を取得開始');

    const collector = new YahooFinanceCollector();
    const results = await collector.getMultipleSymbols(symbols);

    for (const data of results) {
      await saveToBigQuery(data);
    }

    console.log('[FETCH-MULTIPLE] 完了: ' + symbols.length + '個');

    res.json({
      status: 'success',
      fetched: results.length,
      symbols: results.map(r => ({ symbol: r.symbol, company: r.company })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[FETCH-MULTIPLE] エラー:', error);
    res.status(500).json({
      error: '一括取得に失敗しました',
      message: error.message
    });
  }
});

// BigQuery に保存
async function saveToBigQuery(data) {
  try {
    const table = dataset.table('stock_metrics_historical');
    
    const [exists] = await table.exists();
    if (!exists) {
      console.log('テーブル作成: stock_metrics_historical');
      await table.create({
        schema: [
          { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
          { name: 'company', type: 'STRING', mode: 'NULLABLE' },
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
    }

    const fd = data.financialData || {};
    const row = {
      symbol: data.symbol,
      company: data.company,
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
      data_source: fd.dataSource || 'yahoo-finance',
      raw_data: fd
    };

    await table.insert([row]);
    console.log('BQ保存: ' + data.symbol);
    
  } catch (error) {
    console.error('BQ保存エラー:', error);
  }
}

// Cloud Storage に保存
async function saveToStorage(data) {
  try {
    const filename = 'stock-data/' + data.symbol + '/' + data.fetchDate + '/' + Date.now() + '.json';
    const file = bucket.file(filename);
    
    await file.save(JSON.stringify(data, null, 2));
    console.log('Storage保存: ' + filename);
    
  } catch (error) {
    console.error('Storage保存エラー:', error);
  }
}

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MAGI Analytics Crawler',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('MAGI Analytics Crawler listening on port ' + port);
});

module.exports = app;
