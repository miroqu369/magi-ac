'use strict';
const express = require('express');
const { MAGIStorage } = require('@miroqu369/magi-stg');
const YahooFinanceCollector = require('../collectors/yahoo-finance');
const CompanyIntelligence = require('../collectors/company-intelligence');

const app = express();
const PORT = Number(process.env.PORT) || 8888;

app.use(express.json());

// MAGI Storage 初期化（projectId を明示）
const storage = new MAGIStorage({
  bucketName: 'magi-ac-data',
  datasetId: 'magi_ac',
  projectId: 'screen-share-459802'  // ← GCP Project ID
});

const collector = new YahooFinanceCollector();
const intelligence = new CompanyIntelligence();

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.5.0-with-magi-stg',
    service: 'MAGI Analytics Center (Powered by magi-stg)',
    timestamp: new Date().toISOString()
  });
});

// 単一分析
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const quote = await collector.getQuote(symbol.toUpperCase());
    if (!quote) return res.status(404).json({ error: 'Quote not found' });

    await storage.save(quote, {
      type: 'json',
      path: `analyses/${symbol}/${new Date().toISOString()}.json`
    });

    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 最新データ
app.get('/api/latest/:symbol', async (req, res) => {
  try {
    const data = await storage.fetch({
      source: 'bigquery',
      symbol: req.params.symbol.toUpperCase()
    });
    res.json(data || { error: 'No data' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 履歴
app.get('/api/history/:symbol', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await storage.history(req.params.symbol.toUpperCase(), days);
    res.json({ symbol: req.params.symbol.toUpperCase(), days, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 統計
app.get('/api/stats/:symbol', async (req, res) => {
  try {
    const stats = await storage.stats(req.params.symbol.toUpperCase());
    res.json(stats || { error: 'No stats' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Server 起動
storage.initialize().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 MAGI Analytics Center v3.5 (with magi-stg)');
    console.log(`📊 Powered by @miroqu369/magi-stg`);
    console.log(`🔌 Listening on port ${PORT}`);
  });
}).catch(error => {
  console.error('❌ Initialization error:', error);
  process.exit(1);
});
