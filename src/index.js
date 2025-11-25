import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// テクニカル分析モジュールをインポート
import { analyzeSymbol } from './analytics/technical-analyzer.js';

let specifications = {};

// 仕様書を magi-stg から読み込む
async function loadSpecifications() {
  try {
    console.log('📚 Loading specifications from magi-stg...');
    const response = await fetch('https://magi-stg-dtrah63zyq-an.a.run.app/api/specs');
    const data = await response.json();
    
    if (data.specs) {
      specifications = data.specs;
      console.log(`[INFO] ✅ Specifications loaded successfully`);
    }
  } catch (error) {
    console.error('[ERROR] Failed to load specifications:', error.message);
  }
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'magi-ac', 
    timestamp: new Date().toISOString() 
  });
});

app.post('/api/analyze', async (req, res) => {
  const { symbol } = req.body;
  
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  try {
    // テクニカル分析を実行
    const technicalAnalysis = await analyzeSymbol(symbol);
    
    // 既存のレスポンス（AI合議）
    const response = {
      success: true,
      symbol: symbol.toUpperCase(),
      technical: technicalAnalysis,
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    console.error('[ERROR] Analysis error:', error.message);
    res.status(500).json({ 
      error: error.message,
      symbol 
    });
  }
});

// テクニカル分析テスト用エンドポイント
app.get('/api/technical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const technicalData = await analyzeSymbol(symbol);
    res.json({
      symbol,
      technical: technicalData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8888;

await loadSpecifications();

app.listen(PORT, () => {
  console.log(`[INFO] ✅ MAGI Analytics Center running on port ${PORT}`);
});
