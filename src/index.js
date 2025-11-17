'use strict';
const express = require('express');
const { MAGIStorage } = require('@miroqu369/magi-stg');
const YahooFinanceCollector = require('./collectors/yahoo-finance');
const CompanyIntelligence = require('./collectors/company-intelligence');

const app = global.app || express();

// MAGI Storage 初期化（非同期・背景実行）
const storage = new MAGIStorage({
  bucketName: 'magi-ac-data',
  datasetId: 'magi_ac',
  projectId: 'screen-share-459802'
});

storage.initialize().catch(error => {
  console.error('Storage init error:', error.message);
});

const collector = new YahooFinanceCollector();
const intelligence = new CompanyIntelligence();

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

console.log('📊 API routes registered');
// ← listen は削除！（bootstrap.js で実行）
