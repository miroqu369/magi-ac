import express from 'express';
import dotenv from 'dotenv';
import { getStockQuote, getComprehensiveData, getHistoricalData, getIntradayData } from '../collectors/yahoo-finance.js';
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
import { detectVolumeAnomaly, analyzeVolumePattern } from '../analyzers/volume-anomaly.js';
import { analyzeManipulationPatterns } from '../analyzers/price-manipulation.js';
import { analyzeInstitutionalChanges, generateMock13FData } from '../collectors/sec-edgar.js';
import { getShortTrend, detectShortAnomalies } from '../collectors/finra-shorts.js';
import { getDarkPoolData, getWeeklyDarkPoolStats, detectDarkPoolAnomalies } from '../collectors/finra-darkpool.js';
import { analyzeInstitutionalFlow, analyzeDarkPoolActivity, classifyInstitutionalBehavior } from '../analyzers/institutional-flow.js';
import { analyzeWithAIConsensus, quickAIAnalysis } from '../ai/manipulation-detector.js';
import { saveManipulationSignals, saveAIAnalysis, saveInstitutionalPositions, getManipulationHistory, getAIAnalysisHistory, getHighRiskAlerts, getStatsSummary, initializeIAATables, savePrediction, getPredictionHistory, analyzePredictionAccuracy, initializePredictionsTable } from '../bigquery/iaa-storage.js';
import { saveInvestmentAnalysis } from '../bigquery/analytics-storage.js';
import { checkAlertConditions, recordAlert, getActiveAlerts, getAlertSummary, analyzeTrend, addToWatchlist, removeFromWatchlist, getWatchlist, startMonitoring, stopMonitoring, getAlertConfig, updateAlertConfig } from '../utils/alert-system.js';
import { predictStockPrice, predictMultipleStocks } from '../analyzers/prediction-engine.js';

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
    
    // Calculate consensus
    const consensus = calculateConsensus(aiRecommendations);
    
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
      aiRecommendations: aiRecommendations,
      consensus: consensus
    };

    // Save to Cloud Storage
    const storageUri = await saveToStorage(analysisData);
    console.log(`[STORAGE] Saved to: ${storageUri}`);

    // Save to BigQuery (investment analysis table)
    try {
      await saveInvestmentAnalysis(
        analysisData.symbol,
        analysisData.company,
        aiRecommendations,
        consensus
      );
      console.log(`[BIGQUERY] Saved investment analysis for ${analysisData.symbol}`);
    } catch (bqError) {
      console.error('[BIGQUERY] Save failed:', bqError.message);
      // Continue processing even if BigQuery save fails
    }

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
// Institutional Activity Analyzer (IAA) Endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Analyze institutional activity and manipulation signals
app.post('/api/institutional/analyze', async (req, res) => {
  try {
    const { symbol, includeHistorical = false, enableAI = true, aiMode = 'full', saveToDB = true } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    console.log(`[IAA] Starting institutional analysis for ${symbol} (AI: ${enableAI ? aiMode : 'disabled'}, DB: ${saveToDB})`);

    // データ取得を並列実行
    const [
      historicalData, 
      intradayData, 
      currentQuote,
      shortTrend,
      darkPoolData,
      darkPoolWeekly,
      holdings13F
    ] = await Promise.all([
      getHistoricalData(symbol, 20),
      getIntradayData(symbol, '1m', 1),
      getStockQuote(symbol),
      getShortTrend(symbol, 5),
      getDarkPoolData(symbol),
      getWeeklyDarkPoolStats(symbol),
      generateMock13FData(symbol) // Use mock data for now
    ]);

    // 当日データ
    const currentData = {
      volume: intradayData.reduce((sum, d) => sum + (d.volume || 0), 0),
      close: intradayData.length > 0 && intradayData[intradayData.length - 1]?.close 
        ? intradayData[intradayData.length - 1].close 
        : (currentQuote.regularMarketPrice || 150)
    };

    // 出来高異常検知
    console.log('[IAA] Analyzing volume anomalies...');
    const volumeAnomaly = detectVolumeAnomaly({
      historicalData,
      currentData,
      intradayData
    });

    // 出来高パターン分析
    const volumePattern = analyzeVolumePattern(historicalData);

    // 価格操作パターン検出
    console.log('[IAA] Detecting price manipulation patterns...');
    const manipulationPatterns = analyzeManipulationPatterns(intradayData);

    // 空売りデータ分析
    console.log('[IAA] Analyzing short interest...');
    const shortAnomalies = detectShortAnomalies(shortTrend.data);

    // ダークプール分析
    console.log('[IAA] Analyzing dark pool activity...');
    const darkPoolAnomalies = detectDarkPoolAnomalies(darkPoolData);
    const darkPoolAnalysis = analyzeDarkPoolActivity(darkPoolData);

    // 機関投資家フロー分析
    console.log('[IAA] Analyzing institutional flow...');
    const institutionalFlow = analyzeInstitutionalFlow({
      holdings13F: null, // 13F変動分析は今後実装
      darkPoolData,
      shortData: shortTrend.analysis,
      volumeData: volumeAnomaly.metrics
    });

    const behaviorPattern = classifyInstitutionalBehavior(institutionalFlow);

    // シグナル統合
    const signals = [
      ...volumeAnomaly.signals,
      ...shortAnomalies.signals,
      ...darkPoolAnomalies.signals,
      ...(manipulationPatterns.manipulationDetected 
        ? Object.entries(manipulationPatterns.patterns)
            .filter(([_, p]) => p.detected)
            .map(([type, p]) => ({
              type,
              severity: parseFloat(p.confidence) > 0.7 ? 'high' : 'medium',
              description: p.description,
              confidence: p.confidence
            }))
        : []
      )
    ];

    // 総合操作スコア計算
    const manipulationScore = calculateManipulationScore({
      volumeAnomaly,
      manipulationPatterns,
      shortAnomalies,
      darkPoolAnomalies
    });

    // 基本レスポンス構築
    const baseAnalysis = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      manipulation_score: manipulationScore,
      signals: signals,
      volume_analysis: {
        anomaly_detected: volumeAnomaly.anomalyDetected,
        anomaly_score: volumeAnomaly.anomalyScore,
        pattern: volumePattern.pattern,
        metrics: volumeAnomaly.metrics
      },
      price_manipulation: {
        detected: manipulationPatterns.manipulationDetected,
        score: manipulationPatterns.manipulationScore,
        patterns_count: manipulationPatterns.patternsDetected,
        details: manipulationPatterns.patterns
      },
      short_interest: {
        anomaly_detected: shortAnomalies.detected,
        latest_ratio: shortAnomalies.latestRatio || '0',
        trend: shortTrend.analysis.trend,
        avg_ratio: shortTrend.analysis.avgShortRatio || '0',
        change: shortTrend.analysis.change || '0',
        alert: shortTrend.analysis.alert
      },
      dark_pool: {
        anomaly_detected: darkPoolAnomalies.detected,
        percentage: darkPoolData.darkPoolPercentage || '0',
        analysis: darkPoolAnalysis,
        weekly_trend: darkPoolWeekly.analysis
      },
      institutional_activity: {
        flow_direction: institutionalFlow.flowDirection,
        flow_strength: institutionalFlow.flowStrength,
        confidence: institutionalFlow.confidence,
        signals: institutionalFlow.signals,
        interpretation: institutionalFlow.interpretation,
        behavior_pattern: behaviorPattern,
        recent_13f_holdings: holdings13F.holdings.slice(0, 5)
      },
      market_data: {
        current_price: currentData.close || 0,
        daily_volume: currentData.volume || 0,
        avg_volume_20d: volumeAnomaly.metrics?.avgVolume || 0,
        intraday_points: intradayData.length
      }
    };

    // AI分析の実行
    let aiAnalysis = null;
    if (enableAI) {
      console.log(`[IAA] Running AI analysis (mode: ${aiMode})...`);
      try {
        if (aiMode === 'quick') {
          // 単一AI (Gemini) で高速分析
          const quickResult = await quickAIAnalysis(baseAnalysis, 'gemini');
          aiAnalysis = {
            mode: 'quick',
            ai: 'Gemini',
            result: quickResult
          };
        } else {
          // 4AI合議による詳細分析
          const consensusResult = await analyzeWithAIConsensus(baseAnalysis);
          aiAnalysis = {
            mode: 'full',
            ...consensusResult
          };
        }
      } catch (error) {
        console.error('[IAA] AI analysis failed:', error.message);
        aiAnalysis = {
          mode: aiMode,
          error: error.message,
          consensus_available: false
        };
      }
    }

    // アラートチェック
    const alerts = checkAlertConditions(baseAnalysis);
    alerts.forEach(alert => {
      if (recordAlert(alert)) {
        console.log(`[ALERT] ${alert.level}: ${alert.message}`);
      }
    });

    // BigQueryに保存
    let dbSaveStatus = null;
    if (saveToDB) {
      try {
        console.log('[IAA] Saving to BigQuery...');
        const signalId = await saveManipulationSignals(baseAnalysis);
        
        let aiId = null;
        if (aiAnalysis && aiAnalysis.consensus_available) {
          aiId = await saveAIAnalysis(symbol, aiAnalysis);
        }
        
        const positionsCount = await saveInstitutionalPositions(
          symbol, 
          holdings13F.holdings.slice(0, 5)
        );
        
        dbSaveStatus = {
          saved: true,
          signal_id: signalId,
          ai_analysis_id: aiId,
          positions_saved: positionsCount
        };
        
        console.log('[IAA] Successfully saved to BigQuery');
      } catch (error) {
        console.error('[IAA] BigQuery save failed:', error.message);
        dbSaveStatus = {
          saved: false,
          error: error.message
        };
      }
    }

    // 最終レスポンス
    const finalAnalysis = {
      ...baseAnalysis,
      ai_analysis: aiAnalysis,
      alerts: alerts,
      db_save_status: dbSaveStatus
    };

    console.log(`[IAA] Analysis complete: Score ${manipulationScore}, Flow: ${institutionalFlow.flowDirection}, Alerts: ${alerts.length}`);
    if (aiAnalysis?.consensus) {
      console.log(`[IAA] AI Consensus: ${aiAnalysis.consensus.manipulation_likelihood} (agreement: ${aiAnalysis.consensus.agreement_level})`);
    }

    res.json(finalAnalysis);

  } catch (error) {
    console.error('[ERROR] Institutional analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Institutional analysis failed', 
      details: error.message 
    });
  }
});


// Helper: Calculate overall manipulation score
function calculateManipulationScore({ volumeAnomaly, manipulationPatterns, shortAnomalies, darkPoolAnomalies }) {
  let score = 0;
  let weight = 0;
  
  // 出来高異常スコア (weight: 0.25)
  if (volumeAnomaly.anomalyDetected) {
    score += volumeAnomaly.anomalyScore * 0.25;
    weight += 0.25;
  }
  
  // 価格操作パターンスコア (weight: 0.35)
  if (manipulationPatterns.manipulationDetected) {
    score += parseFloat(manipulationPatterns.manipulationScore) * 0.35;
    weight += 0.35;
  }
  
  // 空売り異常スコア (weight: 0.2)
  if (shortAnomalies && shortAnomalies.detected) {
    const shortScore = shortAnomalies.signals.reduce((sum, s) => {
      return sum + (s.severity === 'high' ? 0.8 : 0.5);
    }, 0) / shortAnomalies.signals.length;
    score += shortScore * 0.2;
    weight += 0.2;
  }
  
  // ダークプール異常スコア (weight: 0.2)
  if (darkPoolAnomalies && darkPoolAnomalies.detected) {
    const dpScore = darkPoolAnomalies.signals.reduce((sum, s) => {
      return sum + (s.severity === 'high' ? 0.8 : 0.5);
    }, 0) / darkPoolAnomalies.signals.length;
    score += dpScore * 0.2;
    weight += 0.2;
  }
  
  return weight > 0 ? parseFloat((score / weight).toFixed(2)) : 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Analysis Endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Quick AI analysis (single AI)
app.post('/api/institutional/ai-quick', async (req, res) => {
  try {
    const { symbol, ai = 'gemini' } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    console.log(`[AI-QUICK] Analyzing ${symbol} with ${ai.toUpperCase()}`);

    // 基本データ取得（簡易版）
    const [historicalData, intradayData, currentQuote] = await Promise.all([
      getHistoricalData(symbol, 20),
      getIntradayData(symbol, '1m', 1),
      getStockQuote(symbol)
    ]);

    const currentData = {
      volume: intradayData.reduce((sum, d) => sum + (d.volume || 0), 0),
      close: intradayData.length > 0 && intradayData[intradayData.length - 1]?.close 
        ? intradayData[intradayData.length - 1].close 
        : (currentQuote.regularMarketPrice || 150)
    };

    const volumeAnomaly = detectVolumeAnomaly({ historicalData, currentData, intradayData });
    const manipulationPatterns = analyzeManipulationPatterns(intradayData);

    const simpleAnalysis = {
      symbol: symbol.toUpperCase(),
      signals: [
        ...volumeAnomaly.signals,
        ...(manipulationPatterns.manipulationDetected 
          ? Object.entries(manipulationPatterns.patterns)
              .filter(([_, p]) => p.detected)
              .map(([type, p]) => ({ type, severity: 'medium', description: p.description }))
          : []
        )
      ],
      volumeAnalysis: volumeAnomaly,
      priceManipulation: manipulationPatterns,
      shortInterest: { latest_ratio: '0', trend: 'unknown', alert: false },
      darkPool: { percentage: '0', analysis: { trend: 'unknown', alert: false } },
      marketData: {
        current_price: currentData.close || 0,
        daily_volume: currentData.volume || 0,
        avg_volume_20d: volumeAnomaly.metrics?.avgVolume || 0,
        intraday_points: intradayData.length
      }
    };

    const aiResult = await quickAIAnalysis(simpleAnalysis, ai);

    res.json({
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      ai: ai.toUpperCase(),
      analysis: aiResult,
      raw_signals: simpleAnalysis.signals
    });

  } catch (error) {
    console.error('[ERROR] Quick AI analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Quick AI analysis failed', 
      details: error.message 
    });
  }
});

// Full AI consensus analysis
app.post('/api/institutional/ai-consensus', async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    console.log(`[AI-CONSENSUS] Starting 4-AI consensus for ${symbol}`);

    // 完全なデータセット取得
    const [
      historicalData, 
      intradayData, 
      currentQuote,
      shortTrend,
      darkPoolData
    ] = await Promise.all([
      getHistoricalData(symbol, 20),
      getIntradayData(symbol, '1m', 1),
      getStockQuote(symbol),
      getShortTrend(symbol, 5),
      getDarkPoolData(symbol)
    ]);

    const currentData = {
      volume: intradayData.reduce((sum, d) => sum + (d.volume || 0), 0),
      close: intradayData.length > 0 && intradayData[intradayData.length - 1]?.close 
        ? intradayData[intradayData.length - 1].close 
        : (currentQuote.regularMarketPrice || 150)
    };

    const volumeAnomaly = detectVolumeAnomaly({ historicalData, currentData, intradayData });
    const manipulationPatterns = analyzeManipulationPatterns(intradayData);
    const shortAnomalies = detectShortAnomalies(shortTrend.data);
    const darkPoolAnomalies = detectDarkPoolAnomalies(darkPoolData);

    const signals = [
      ...volumeAnomaly.signals,
      ...shortAnomalies.signals,
      ...darkPoolAnomalies.signals,
      ...(manipulationPatterns.manipulationDetected 
        ? Object.entries(manipulationPatterns.patterns)
            .filter(([_, p]) => p.detected)
            .map(([type, p]) => ({ type, severity: 'medium', description: p.description }))
        : []
      )
    ];

    const analysisData = {
      symbol: symbol.toUpperCase(),
      signals,
      volumeAnalysis: volumeAnomaly,
      priceManipulation: manipulationPatterns,
      shortInterest: {
        anomaly_detected: shortAnomalies.detected,
        latest_ratio: shortAnomalies.latestRatio || '0',
        trend: shortTrend.analysis.trend,
        avg_ratio: shortTrend.analysis.avgShortRatio || '0',
        change: shortTrend.analysis.change || '0',
        alert: shortTrend.analysis.alert
      },
      darkPool: {
        anomaly_detected: darkPoolAnomalies.detected,
        percentage: darkPoolData.darkPoolPercentage || '0',
        analysis: { 
          trend: 'normal', 
          alert: darkPoolAnomalies.detected,
          interpretation: 'ダークプール分析'
        }
      },
      marketData: {
        current_price: currentData.close || 0,
        daily_volume: currentData.volume || 0,
        avg_volume_20d: volumeAnomaly.metrics?.avgVolume || 0,
        intraday_points: intradayData.length
      }
    };

    const consensusResult = await analyzeWithAIConsensus(analysisData);

    res.json({
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...consensusResult,
      raw_signals_count: signals.length
    });

  } catch (error) {
    console.error('[ERROR] AI consensus failed:', error.message);
    res.status(500).json({ 
      error: 'AI consensus failed', 
      details: error.message 
    });
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BigQuery & Alert Endpoints (Phase 4)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get manipulation history
app.get('/api/institutional/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 30 } = req.query;
    
    console.log(`[HISTORY] Fetching history for ${symbol} (${days} days)`);
    
    const history = await getManipulationHistory(symbol.toUpperCase(), parseInt(days));
    
    res.json({
      symbol: symbol.toUpperCase(),
      period_days: parseInt(days),
      total_records: history.length,
      history: history
    });
    
  } catch (error) {
    console.error('[ERROR] History fetch failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get AI analysis history
app.get('/api/institutional/ai-history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { days = 30 } = req.query;
    
    console.log(`[AI-HISTORY] Fetching AI history for ${symbol} (${days} days)`);
    
    const history = await getAIAnalysisHistory(symbol.toUpperCase(), parseInt(days));
    
    res.json({
      symbol: symbol.toUpperCase(),
      period_days: parseInt(days),
      total_records: history.length,
      history: history
    });
    
  } catch (error) {
    console.error('[ERROR] AI history fetch failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get high-risk alerts
app.get('/api/institutional/alerts', async (req, res) => {
  try {
    const { threshold = 0.7, limit = 50 } = req.query;
    
    console.log(`[ALERTS] Fetching high-risk alerts (threshold: ${threshold})`);
    
    const alerts = await getHighRiskAlerts(parseFloat(threshold), parseInt(limit));
    
    res.json({
      threshold: parseFloat(threshold),
      total: alerts.length,
      alerts: alerts
    });
    
  } catch (error) {
    console.error('[ERROR] Alerts fetch failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get active realtime alerts
app.get('/api/institutional/alerts/active', (req, res) => {
  try {
    const activeAlerts = getActiveAlerts();
    const summary = getAlertSummary();
    
    res.json({
      summary: summary,
      active_alerts: activeAlerts
    });
    
  } catch (error) {
    console.error('[ERROR] Active alerts fetch failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get statistics summary
app.get('/api/institutional/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    console.log(`[STATS] Fetching stats summary (${days} days)`);
    
    const stats = await getStatsSummary(parseInt(days));
    
    res.json({
      period_days: parseInt(days),
      stats: stats
    });
    
  } catch (error) {
    console.error('[ERROR] Stats fetch failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Analyze trend for symbol
app.get('/api/institutional/trend/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`[TREND] Analyzing trend for ${symbol}`);
    
    const trend = await analyzeTrend(symbol.toUpperCase());
    
    res.json({
      symbol: symbol.toUpperCase(),
      trend: trend
    });
    
  } catch (error) {
    console.error('[ERROR] Trend analysis failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Watchlist management
app.get('/api/institutional/watchlist', (req, res) => {
  try {
    const watchlist = getWatchlist();
    res.json({
      total: watchlist.length,
      symbols: watchlist
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/institutional/watchlist', (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    addToWatchlist(symbol);
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      watchlist: getWatchlist()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/institutional/watchlist/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const removed = removeFromWatchlist(symbol);
    
    res.json({
      success: removed,
      symbol: symbol.toUpperCase(),
      watchlist: getWatchlist()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Monitoring control
app.post('/api/institutional/monitoring/start', (req, res) => {
  try {
    const started = startMonitoring();
    res.json({
      success: started,
      message: started ? 'Monitoring started' : 'Already running',
      config: getAlertConfig()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/institutional/monitoring/stop', (req, res) => {
  try {
    const stopped = stopMonitoring();
    res.json({
      success: stopped,
      message: stopped ? 'Monitoring stopped' : 'Not running'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/institutional/monitoring/config', (req, res) => {
  try {
    const config = getAlertConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/institutional/monitoring/config', (req, res) => {
  try {
    const updates = req.body;
    const newConfig = updateAlertConfig(updates);
    res.json({
      success: true,
      config: newConfig
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize BigQuery tables
app.post('/api/admin/init-iaa-tables', async (req, res) => {
  try {
    console.log('[ADMIN] Initializing IAA BigQuery tables...');
    await initializeIAATables();
    res.json({
      success: true,
      message: 'IAA tables initialized successfully'
    });
  } catch (error) {
    console.error('[ADMIN] Table initialization failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PREDICTION ENDPOINTS ====================

/**
 * POST /api/predict
 * AI株価予測（単一銘柄）
 */
app.post('/api/predict', async (req, res) => {
  try {
    const { symbol, horizon = '3months', enableAI = false } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // horizon バリデーション
    const validHorizons = ['1day', '1week', '1month', '3months', '2years'];
    if (!validHorizons.includes(horizon)) {
      return res.status(400).json({ 
        error: 'Invalid horizon',
        valid_horizons: validHorizons 
      });
    }

    console.log(`[PREDICT] Starting prediction for ${symbol} (${horizon}, AI=${enableAI})`);

    // 予測実行
    const prediction = await predictStockPrice(symbol, horizon, enableAI);

    // BigQueryに保存
    if (process.env.BIGQUERY_ENABLED === 'true') {
      try {
        await savePrediction(prediction);
      } catch (error) {
        console.warn('[PREDICT] Failed to save to BigQuery:', error.message);
      }
    }

    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    console.error('[PREDICT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/predict/batch
 * バッチ予測（複数銘柄）
 */
app.post('/api/predict/batch', async (req, res) => {
  try {
    const { symbols, horizon = '3months', enableAI = false } = req.body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'Symbols array is required' });
    }

    if (symbols.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 symbols allowed per request' });
    }

    console.log(`[PREDICT BATCH] Starting batch prediction for ${symbols.length} symbols`);

    const predictions = await predictMultipleStocks(symbols, horizon, enableAI);

    // BigQueryに保存
    if (process.env.BIGQUERY_ENABLED === 'true') {
      for (const prediction of predictions) {
        if (!prediction.error) {
          try {
            await savePrediction(prediction);
          } catch (error) {
            console.warn(`[PREDICT BATCH] Failed to save ${prediction.symbol}:`, error.message);
          }
        }
      }
    }

    res.json({
      success: true,
      total: predictions.length,
      successful: predictions.filter(p => !p.error).length,
      failed: predictions.filter(p => p.error).length,
      data: predictions
    });

  } catch (error) {
    console.error('[PREDICT BATCH] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/predict/history/:symbol
 * 予測履歴を取得
 */
app.get('/api/predict/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { horizon, days = 30 } = req.query;

    console.log(`[PREDICT HISTORY] Fetching history for ${symbol}`);

    const history = await getPredictionHistory(symbol, horizon, parseInt(days));

    res.json({
      success: true,
      symbol,
      horizon: horizon || 'all',
      days: parseInt(days),
      count: history.length,
      data: history
    });

  } catch (error) {
    console.error('[PREDICT HISTORY] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/predict/accuracy/:symbol
 * 予測精度を分析
 */
app.get('/api/predict/accuracy/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { horizon = '1day', days = 30 } = req.query;

    console.log(`[PREDICT ACCURACY] Analyzing accuracy for ${symbol}`);

    const accuracy = await analyzePredictionAccuracy(symbol, horizon, parseInt(days));

    res.json({
      success: true,
      symbol,
      horizon,
      days: parseInt(days),
      data: accuracy
    });

  } catch (error) {
    console.error('[PREDICT ACCURACY] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/init-predictions-table
 * 予測テーブル初期化
 */
app.post('/api/admin/init-predictions-table', async (req, res) => {
  try {
    console.log('[ADMIN] Initializing predictions table...');
    await initializePredictionsTable();
    res.json({
      success: true,
      message: 'Predictions table initialized successfully'
    });
  } catch (error) {
    console.error('[ADMIN] Predictions table initialization failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate consensus from AI recommendations
 */
function calculateConsensus(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }
  
  const counts = { BUY: 0, HOLD: 0, SELL: 0 };
  let totalConfidence = 0;
  
  recommendations.forEach(rec => {
    const action = rec.action?.toUpperCase() || 'HOLD';
    if (counts.hasOwnProperty(action)) {
      counts[action]++;
    }
    totalConfidence += (rec.confidence || 0.5);
  });
  
  // Find the action with most votes
  const maxAction = Object.keys(counts).reduce((a, b) => 
    counts[a] > counts[b] ? a : b
  );
  
  return {
    recommendation: maxAction,
    buy: counts.BUY,
    hold: counts.HOLD,
    sell: counts.SELL,
    average_confidence: recommendations.length > 0 
      ? (totalConfidence / recommendations.length).toFixed(2) 
      : 0
  };
}

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   MAGI Analytics Center v3.2         ║
║   AI Stock Price Prediction          ║
║   Port: ${PORT}                          ║
║   Status: Running                     ║
╚═══════════════════════════════════════╝
  `);
});
