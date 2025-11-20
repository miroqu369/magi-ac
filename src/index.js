import express from 'express';
import dotenv from 'dotenv';
import { getStockQuote } from '../collectors/yahoo-finance.js';
import { saveToStorage } from '../utils/storage.js';
import { 
  queryLatestPrice, 
  queryPriceHistory, 
  queryStats,
  createExternalTable 
} from '../bigquery/analytics.js';
import { getGrokRecommendation } from '../collectors/grok.js';
import { getGeminiRecommendation } from '../collectors/gemini.js';
import { getClaudeRecommendation } from '../collectors/claude.js';
import { getMistralRecommendation } from '../collectors/mistral.js';
import { analyzeSentiment, summarizeReport, analyzeDocument } from '../collectors/cohere.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '3.1.0',
    service: 'MAGI Analytics Center',
    timestamp: new Date().toISOString()
  });
});

// Analyze single symbol
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    console.log(`[ANALYZE] Starting analysis for ${symbol}`);

    // Get stock data from Yahoo Finance
    const stockData = await getStockQuote(symbol);
    
    // Get AI recommendations from all 4 MAGI units in parallel
    console.log('[MAGI] Requesting recommendations from all units...');
    const aiPromises = [
      getGrokRecommendation(stockData, symbol),
      getGeminiRecommendation(stockData, symbol),
      getClaudeRecommendation(stockData, symbol),
      getMistralRecommendation(stockData, symbol)
    ];
    
    const aiResults = await Promise.allSettled(aiPromises);
    const aiRecommendations = aiResults
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    console.log(`[MAGI] Received ${aiRecommendations.length}/4 recommendations`);
    
    // Prepare analysis data
    const analysisData = {
      symbol: symbol.toUpperCase(),
      company: stockData.shortName || stockData.longName || 'Unknown',
      timestamp: new Date().toISOString(),
      financialData: {
        currentPrice: stockData.regularMarketPrice,
        previousClose: stockData.regularMarketPreviousClose,
        marketCap: stockData.marketCap,
        pe: stockData.trailingPE,
        eps: stockData.epsTrailingTwelveMonths,
        revenue: stockData.totalRevenue,
        profitMargin: stockData.profitMargins,
        debtToEquity: stockData.debtToEquity
      },
      aiRecommendations: aiRecommendations
    };

    // Save to Cloud Storage
    const storageUri = await saveToStorage(analysisData);
    console.log(`[STORAGE] Saved to: ${storageUri}`);

    res.json({
      ...analysisData,
      storageUri
    });

  } catch (error) {
    console.error('[ERROR] Analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Analysis failed', 
      details: error.message 
    });
  }
});

// Get latest price from BigQuery
app.get('/api/analytics/latest/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await queryLatestPrice(symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('[ERROR] Latest price query failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get price history from BigQuery
app.get('/api/analytics/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const days = parseInt(req.query.days) || 30;
    const data = await queryPriceHistory(symbol.toUpperCase(), days);
    res.json(data);
  } catch (error) {
    console.error('[ERROR] History query failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics from BigQuery
app.get('/api/analytics/stats/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await queryStats(symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('[ERROR] Stats query failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Initialize BigQuery external table
app.post('/api/admin/init-bigquery', async (req, res) => {
  try {
    await createExternalTable();
    res.json({ 
      success: true, 
      message: 'BigQuery external table created successfully' 
    });
  } catch (error) {
    console.error('[ERROR] BigQuery init failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cohere Document Analysis Endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Analyze document (text/PDF)
app.post('/api/document/analyze', async (req, res) => {
  try {
    const { text, documentType, symbol } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`[DOCUMENT] Analyzing ${documentType || 'general'} document`);

    const analysis = await analyzeDocument(text, {
      documentType: documentType || 'general',
      symbol
    });

    res.json({
      success: true,
      symbol,
      documentType: documentType || 'general',
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Document analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Document analysis failed', 
      details: error.message 
    });
  }
});

// Sentiment analysis
app.post('/api/document/sentiment', async (req, res) => {
  try {
    const { text, symbol } = req.body;
    
    if (!text || !symbol) {
      return res.status(400).json({ error: 'Text and symbol are required' });
    }

    console.log(`[SENTIMENT] Analyzing sentiment for ${symbol}`);

    const sentiment = await analyzeSentiment(text, symbol);

    res.json({
      success: true,
      symbol,
      sentiment,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Sentiment analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Sentiment analysis failed', 
      details: error.message 
    });
  }
});

// Summarize report
app.post('/api/document/summarize', async (req, res) => {
  try {
    const { text, symbol, reportType } = req.body;
    
    if (!text || !symbol) {
      return res.status(400).json({ error: 'Text and symbol are required' });
    }

    console.log(`[SUMMARIZE] Summarizing ${reportType || 'report'} for ${symbol}`);

    const summary = await summarizeReport(text, symbol, reportType);

    res.json({
      success: true,
      symbol,
      reportType: reportType || 'general',
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Report summarization failed:', error.message);
    res.status(500).json({ 
      error: 'Report summarization failed', 
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   MAGI Analytics Center v3.1         ║
║   Port: ${PORT}                          ║
║   Status: Running                     ║
╚═══════════════════════════════════════╝
  `);
});
