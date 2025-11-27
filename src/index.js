import express from 'express';
import dotenv from 'dotenv';
import { analyzeSymbol } from './analytics/technical-analyzer.js';
import { analyzeWithConsensus } from './analytics/ai-consensus.js';
import { bigQueryStorage } from '../storage/bigquery.js';
import { documentStorage } from '../storage/document-storage.js';
import { extractFinancials, analyzeSentiment, summarizeDocument } from '../collectors/cohere.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'magi-ac', timestamp: new Date().toISOString() });
});

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

app.post('/api/ai-consensus', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    console.log('[AI-Consensus] Request for ' + symbol);
    
    const technical = await analyzeSymbol(symbol);
    const consensus = await analyzeWithConsensus(symbol, technical);
    
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

// Document API endpoints

app.post('/api/document/extract-financials', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: 'text and symbol are required' });
    }
    console.log('[Cohere] Extract financials for ' + symbol);
    
    const result = await extractFinancials(text, symbol);
    
    documentStorage.saveDocumentAnalysis(symbol, 'financials', result, text)
      .catch(err => console.error('[DocumentStorage] Save failed:', err.message));
    
    res.json(result);
  } catch (error) {
    console.error('[Cohere Extract] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/document/sentiment', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: 'text and symbol are required' });
    }
    console.log('[Cohere] Sentiment analysis for ' + symbol);
    
    const result = await analyzeSentiment(text, symbol);
    
    documentStorage.saveDocumentAnalysis(symbol, 'sentiment', result, text)
      .catch(err => console.error('[DocumentStorage] Save failed:', err.message));
    
    res.json(result);
  } catch (error) {
    console.error('[Cohere Sentiment] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/document/summarize', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: 'text and symbol are required' });
    }
    console.log('[Cohere] Summarize document for ' + symbol);
    
    const result = await summarizeDocument(text, symbol);
    
    documentStorage.saveDocumentAnalysis(symbol, 'summary', result, text)
      .catch(err => console.error('[DocumentStorage] Save failed:', err.message));
    
    res.json(result);
  } catch (error) {
    console.error('[Cohere Summarize] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/document/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const type = req.query.type || null;  // sentiment, financials, summary
    const limit = parseInt(req.query.limit) || 20;
    
    const history = await documentStorage.getDocumentHistory(symbol, type, limit);
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: history.length,
      history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Document History] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default app;
