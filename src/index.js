import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// モジュールをインポート
import { analyzeSymbol } from './analytics/technical-analyzer.js';
import { analyzeWithConsensus } from './analytics/ai-consensus.js';
import { bigQueryStorage } from '../storage/bigquery.js';
import { extractFinancials, analyzeSentiment, summarizeDocument } from '../collectors/cohere.js';

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
    
    const technical = await analyzeSymbol(symbol);
    const consensus = await analyzeWithConsensus(symbol, technical);
    
    // BigQueryに保存（非同期）
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

// 分析履歴取得
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

// AI判断詳細取得
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

// ===== Cohere 文書解析エンドポイント =====

// 決算書から財務数値を抽出
app.post('/api/document/extract-financials', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: 'text and symbol are required' });
    }
    console.log('[Cohere] Extract financials for ' + symbol);
    
    const result = await extractFinancials(text, symbol);
    res.json(result);
  } catch (error) {
    console.error('[Cohere Extract] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// センチメント分析
app.post('/api/document/sentiment', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: 'text and symbol are required' });
    }
    console.log('[Cohere] Sentiment analysis for ' + symbol);
    
    const result = await analyzeSentiment(text, symbol);
    res.json(result);
  } catch (error) {
    console.error('[Cohere Sentiment] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 文書要約
app.post('/api/document/summarize', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: 'text and symbol are required' });
    }
    console.log('[Cohere] Summarize document for ' + symbol);
    
    const result = await summarizeDocument(text, symbol);
    res.json(result);
  } catch (error) {
    console.error('[Cohere Summarize] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`[INFO] ✅ MAGI Analytics Center running on port ${PORT}`);
  console.log(`[INFO] 📊 BigQuery integration enabled`);
  console.log(`[INFO] 📄 Cohere document analysis enabled`);
});
