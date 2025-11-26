import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// モジュールをインポート
import { analyzeSymbol } from './analytics/technical-analyzer.js';
import { analyzeWithConsensus } from './analytics/ai-consensus.js';
import { bigQueryStorage } from '../storage/bigquery.js';

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'magi-ac', timestamp: new Date().toISOString() });
});

// テクニカル分析（POST）
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

// 4AI合議エンドポイント（BigQuery保存付き）
app.post('/api/ai-consensus', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    console.log('[AI-Consensus] Request for ' + symbol);
    
    // テクニカル分析を実行
    const technical = await analyzeSymbol(symbol);
    
    // 4AI合議分析を実行
    const consensus = await analyzeWithConsensus(symbol, technical);
    
    // BigQueryに保存（非同期、エラーでも継続）
    bigQueryStorage.saveConsensusAnalysis(symbol, technical, consensus)
      .catch(err => console.error('[BigQuery] Background save failed:', err.message));
    
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

// 分析履歴取得エンドポイント
app.get('/api/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const history = await bigQueryStorage.getAnalysisHistory(symbol, limit);
    
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: history.length,
      history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[History] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// AI判断詳細取得エンドポイント
app.get('/api/history/detail/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    
    const judgments = await bigQueryStorage.getJudgmentDetails(analysisId);
    
    res.json({
      success: true,
      analysisId,
      count: judgments.length,
      judgments,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[History Detail] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`[INFO] ✅ MAGI Analytics Center running on port ${PORT}`);
  console.log(`[INFO] 📊 BigQuery integration enabled`);
});
