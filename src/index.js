'use strict';
const express = require('express');
const StorageService = require('../utils/storage');
const YahooFinanceCollector = require('../collectors/yahoo-finance');
const Analytics = require('../bigquery/analytics');
const ExternalTablesManager = require('../bigquery/external-tables');

const app = express();
const PORT = Number(process.env.PORT) || 8888;

app.use(express.json());

const storage = new StorageService();
const collector = new YahooFinanceCollector();
const analytics = new Analytics();

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.1.0',
    service: 'MAGI Analytics Center',
    timestamp: new Date().toISOString()
  });
});

// 分析API
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const quoteData = await collector.getQuote(symbol.toUpperCase());
    if (!quoteData) return res.status(404).json({ error: 'Quote not found' });

    // Cloud Storageに保存
    try {
      const path = `raw/financials/${Date.now()}-${symbol}.json`;
      await storage.save(quoteData, path);
    } catch (e) {
      console.log('Storage save (non-fatal):', e.message);
    }

    res.json(quoteData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// BigQuery Analytics
app.get('/api/analytics/latest/:symbol', async (req, res) => {
  const latest = await analytics.getLatestPrice(req.params.symbol.toUpperCase());
  res.json(latest || { error: 'No data' });
});

app.get('/api/analytics/history/:symbol', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const history = await analytics.getPriceHistory(req.params.symbol.toUpperCase(), days);
  res.json({ symbol: req.params.symbol.toUpperCase(), days, history });
});

app.get('/api/analytics/stats/:symbol', async (req, res) => {
  const stats = await analytics.getSymbolStats(req.params.symbol.toUpperCase());
  res.json(stats || { error: 'No data' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 MAGI Analytics Center v3.1 on port ' + PORT);
  console.log('📊 Components: BigQuery + Cloud Storage + Yahoo Finance');
  
  const tables = new ExternalTablesManager();
  tables.setupFinancialsTable();
});
