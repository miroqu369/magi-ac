import express from 'express';
import dotenv from 'dotenv';
import { getStockQuote, getComprehensiveData } from '../collectors/yahoo-finance.js';
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

// Swing Trading Analysis Endpoint (Enhanced with Alpha Vantage)
app.post('/api/swing/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    console.log(`[SWING] Starting swing analysis for ${symbol}`);

    // Get comprehensive data from Alpha Vantage (quote + historical + indicators)
    const alphaData = await getComprehensiveData(symbol);
    
    const currentPrice = alphaData.quote.price;
    const previousClose = alphaData.quote.previousClose;
    const change = alphaData.quote.change;
    const changePercent = alphaData.quote.changePercent;
    
    // Use calculated RSI from Alpha Vantage
    const rsi = alphaData.indicators.rsi;
    const sma50 = alphaData.indicators.sma50;
    const sma200 = alphaData.indicators.sma200;
    
    // Determine trend using accurate moving averages
    const trend = determineTrend(currentPrice, sma50, sma200);
    
    // Calculate 52-week high/low from historical data
    const historicalPrices = alphaData.timeSeries.map(d => d.close);
    const fiftyTwoWeekHigh = Math.max(...historicalPrices);
    const fiftyTwoWeekLow = Math.min(...historicalPrices);
    
    // Swing trading decision logic
    const swingDecision = makeSwingDecision(
      rsi, 
      trend, 
      currentPrice, 
      sma50, 
      sma200,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow
    );
    
    // Prepare response
    const analysis = {
      symbol: symbol.toUpperCase(),
      company: `${symbol} Inc.`,
      timestamp: new Date().toISOString(),
      
      // Price data
      priceData: {
        current: currentPrice,
        previousClose: previousClose,
        change: change,
        changePercent: changePercent,
        fiftyDayAvg: sma50,
        twoHundredDayAvg: sma200,
        fiftyTwoWeekHigh: fiftyTwoWeekHigh,
        fiftyTwoWeekLow: fiftyTwoWeekLow
      },
      
      // Technical indicators
      technicalIndicators: {
        rsi: rsi.toFixed(2),
        trend: trend,
        support: swingDecision.support,
        resistance: swingDecision.resistance
      },
      
      // Swing trading recommendation
      recommendation: {
        action: swingDecision.action,
        confidence: swingDecision.confidence,
        entryPrice: swingDecision.entryPrice,
        stopLoss: swingDecision.stopLoss,
        takeProfit: swingDecision.takeProfit,
        reasoning: swingDecision.reasoning
      },
      
      // Data source
      dataSource: 'Alpha Vantage',
      historicalDataPoints: alphaData.timeSeries.length
    };

    console.log(`[SWING] Analysis complete: ${swingDecision.action} (${swingDecision.confidence}% confidence)`);

    res.json(analysis);

  } catch (error) {
    console.error('[ERROR] Swing analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Swing analysis failed', 
      details: error.message 
    });
  }
});

// Helper function: Calculate simplified RSI
function calculateSimpleRSI(currentPrice, previousClose, stockData) {
  const change = currentPrice - previousClose;
  const avgGain = Math.abs(change) > 0 && change > 0 ? Math.abs(change) : 0.5;
  const avgLoss = Math.abs(change) > 0 && change < 0 ? Math.abs(change) : 0.5;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  const fiftyDayAvg = stockData.fiftyDayAverage || currentPrice;
  if (currentPrice > fiftyDayAvg * 1.1) return Math.min(rsi + 15, 85);
  if (currentPrice < fiftyDayAvg * 0.9) return Math.max(rsi - 15, 15);
  
  return rsi;
}

// Helper function: Determine trend
function determineTrend(currentPrice, fiftyDayAvg, twoHundredDayAvg) {
  if (currentPrice > fiftyDayAvg && fiftyDayAvg > twoHundredDayAvg) {
    return 'STRONG_UPTREND';
  } else if (currentPrice > fiftyDayAvg) {
    return 'UPTREND';
  } else if (currentPrice < fiftyDayAvg && fiftyDayAvg < twoHundredDayAvg) {
    return 'STRONG_DOWNTREND';
  } else if (currentPrice < fiftyDayAvg) {
    return 'DOWNTREND';
  } else {
    return 'SIDEWAYS';
  }
}

// Helper function: Make swing trading decision
function makeSwingDecision(rsi, trend, currentPrice, fiftyDayAvg, twoHundredDayAvg, high52w, low52w) {
  let action = 'WAIT';
  let confidence = 0;
  let reasoning = '';
  
  const support = Math.max(fiftyDayAvg * 0.95, low52w);
  const resistance = Math.min(fiftyDayAvg * 1.05, high52w);
  
  if (rsi < 35 && (trend === 'UPTREND' || trend === 'STRONG_UPTREND')) {
    action = 'BUY';
    confidence = 85;
    reasoning = 'Oversold in uptrend - good entry point';
  } else if (rsi < 30) {
    action = 'BUY';
    confidence = 75;
    reasoning = 'Oversold condition - potential reversal';
  } else if (rsi >= 35 && rsi <= 45 && trend === 'STRONG_UPTREND') {
    action = 'BUY';
    confidence = 70;
    reasoning = 'Pullback in strong uptrend';
  } else if (rsi > 70 && (trend === 'DOWNTREND' || trend === 'STRONG_DOWNTREND')) {
    action = 'SELL';
    confidence = 85;
    reasoning = 'Overbought in downtrend - exit position';
  } else if (rsi > 75) {
    action = 'SELL';
    confidence = 80;
    reasoning = 'Extremely overbought - take profits';
  } else if (rsi >= 45 && rsi <= 55) {
    action = 'WAIT';
    confidence = 60;
    reasoning = 'Neutral zone - wait for better setup';
  } else if (trend === 'SIDEWAYS') {
    action = 'WAIT';
    confidence = 50;
    reasoning = 'Sideways market - no clear trend';
  } else {
    action = 'WAIT';
    confidence = 55;
    reasoning = 'No clear swing setup';
  }
  
  let entryPrice, stopLoss, takeProfit;
  
  if (action === 'BUY') {
    entryPrice = currentPrice * 0.995;
    stopLoss = currentPrice * 0.95;
    takeProfit = currentPrice * 1.10;
  } else if (action === 'SELL') {
    entryPrice = currentPrice * 1.005;
    stopLoss = currentPrice * 1.05;
    takeProfit = currentPrice * 0.90;
  } else {
    entryPrice = currentPrice;
    stopLoss = currentPrice * 0.95;
    takeProfit = currentPrice * 1.08;
  }
  
  return {
    action,
    confidence,
    reasoning,
    support: support.toFixed(2),
    resistance: resistance.toFixed(2),
    entryPrice: entryPrice.toFixed(2),
    stopLoss: stopLoss.toFixed(2),
    takeProfit: takeProfit.toFixed(2)
  };
}

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   MAGI Analytics Center v3.1         ║
║   Port: ${PORT}                          ║
║   Status: Running                     ║
╚═══════════════════════════════════════╝
  `);
});
