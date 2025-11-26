import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// テクニカル分析モジュールをインポート
import { analyzeSymbol } from './analytics/technical-analyzer.js';
import { analyzeWithConsensus } from './analytics/ai-consensus.js';

let specifications = {};

// 仕様書を magi-stg から読み込む
async function loadSpecifications() {
  try {
    console.log('📚 Loading specifications from magi-stg...');
    const res = await fetch('https://magi-stg-dtrah63zyq-an.a.run.app/api/specs');
    specifications = await res.json();
    console.log('[INFO] Specifications loaded successfully');
  } catch (error) {
    console.error('[ERROR] Failed to load specifications:', error.message);
  }
}

loadSpecifications();

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'magi-ac', timestamp: new Date().toISOString() });
});

// 銘柄分析（テクニカル指標）
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const technical = await analyzeSymbol(symbol);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      technical,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Analyze] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// テクニカル分析（GET）
app.get('/api/technical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const technical = await analyzeSymbol(symbol);
    
    res.json({
      symbol: symbol.toUpperCase(),
      technical,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Technical] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 4AI合議エンドポイント
app.post('/api/ai-consensus', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    console.log('[AI-Consensus] Request for ' + symbol);
    
    // まずテクニカル分析を実行
    const technical = await analyzeSymbol(symbol);
    
    // 4AI合議分析を実行
    const consensus = await analyzeWithConsensus(symbol, technical);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      technical,
      aiConsensus: consensus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AI-Consensus] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`[INFO] ✅ MAGI Analytics Center running on port ${PORT}`);
});
