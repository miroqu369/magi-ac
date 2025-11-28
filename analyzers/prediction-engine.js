import { getHistoricalData } from '../collectors/yahoo-finance.js';
import { get4AIPredictions, generateMockPredictions } from '../predictors/ai-predictor.js';

/**
 * RSI (Relative Strength Index) を計算
 */
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  // 初回平均を計算
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // RSI計算
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * MACD (Moving Average Convergence Divergence) を計算
 */
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) return null;
  
  // EMA計算
  const calcEMA = (data, period) => {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };
  
  const fastEMA = calcEMA(prices.slice(-fastPeriod), fastPeriod);
  const slowEMA = calcEMA(prices.slice(-slowPeriod), slowPeriod);
  const macdLine = fastEMA - slowEMA;
  
  // シグナルライン（MACDの9日EMA）
  const macdValues = [];
  for (let i = slowPeriod; i < prices.length; i++) {
    const fast = calcEMA(prices.slice(i - fastPeriod, i), fastPeriod);
    const slow = calcEMA(prices.slice(i - slowPeriod, i), slowPeriod);
    macdValues.push(fast - slow);
  }
  
  const signal = macdValues.length >= signalPeriod ? calcEMA(macdValues.slice(-signalPeriod), signalPeriod) : macdLine;
  const histogram = macdLine - signal;
  
  return {
    value: macdLine,
    signal: signal,
    histogram: histogram
  };
}

/**
 * ボリンジャーバンド (Bollinger Bands) を計算
 */
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return null;
  
  const recentPrices = prices.slice(-period);
  const sma = recentPrices.reduce((sum, p) => sum + p, 0) / period;
  
  const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    middle: sma,
    upper: sma + (standardDeviation * stdDev),
    lower: sma - (standardDeviation * stdDev),
    bandwidth: (standardDeviation * stdDev * 2) / sma * 100
  };
}

/**
 * 移動平均を計算
 */
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const recentPrices = prices.slice(-period);
  return recentPrices.reduce((sum, p) => sum + p, 0) / period;
}

/**
 * テクニカル指標を計算
 */
export async function calculateTechnicalIndicators(symbol) {
  try {
    console.log(`[PREDICTION ENGINE] Calculating technical indicators for ${symbol}`);
    
    // 過去60日のデータ取得
    const historicalData = await getHistoricalData(symbol, '60d');
    
    if (!historicalData || historicalData.length < 30) {
      console.warn(`[PREDICTION ENGINE] Insufficient historical data for ${symbol}`);
      return null;
    }
    
    const closePrices = historicalData.map(d => d.close);
    
    const rsi = calculateRSI(closePrices, 14);
    const macd = calculateMACD(closePrices, 12, 26, 9);
    const bb = calculateBollingerBands(closePrices, 20, 2);
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    
    const indicators = {
      rsi,
      macd,
      bb,
      sma20,
      sma50,
      currentPrice: closePrices[closePrices.length - 1],
      priceChange: closePrices[closePrices.length - 1] - closePrices[0],
      priceChangePercent: ((closePrices[closePrices.length - 1] - closePrices[0]) / closePrices[0]) * 100
    };
    
    console.log(`[PREDICTION ENGINE] Technical indicators calculated:`, {
      symbol,
      rsi: rsi?.toFixed(2),
      macd: macd?.value?.toFixed(2),
      bb_position: bb ? ((indicators.currentPrice - bb.lower) / (bb.upper - bb.lower) * 100).toFixed(1) + '%' : 'N/A'
    });
    
    return indicators;
    
  } catch (error) {
    console.error(`[PREDICTION ENGINE] Error calculating indicators:`, error.message);
    return null;
  }
}

/**
 * 4AIのコンセンサス予測を生成
 */
function generateConsensus(aiPredictions, currentPrice) {
  if (aiPredictions.length === 0) {
    return {
      predicted_price: currentPrice,
      direction: 'NEUTRAL',
      confidence: 0,
      upvotes: 0,
      downvotes: 0,
      neutral: 0
    };
  }
  
  // 加重平均（信頼度でウェイト付け）
  let totalWeight = 0;
  let weightedPriceSum = 0;
  
  let upvotes = 0;
  let downvotes = 0;
  let neutral = 0;
  
  aiPredictions.forEach(pred => {
    const weight = pred.confidence;
    totalWeight += weight;
    weightedPriceSum += pred.predicted_price * weight;
    
    if (pred.direction === 'UP') upvotes++;
    else if (pred.direction === 'DOWN') downvotes++;
    else neutral++;
  });
  
  const consensusPrice = totalWeight > 0 ? weightedPriceSum / totalWeight : currentPrice;
  const avgConfidence = totalWeight / aiPredictions.length;
  
  // コンセンサス方向を決定
  let consensusDirection = 'NEUTRAL';
  if (upvotes > aiPredictions.length / 2) consensusDirection = 'UP';
  else if (downvotes > aiPredictions.length / 2) consensusDirection = 'DOWN';
  
  // 価格変動率
  const priceChange = ((consensusPrice - currentPrice) / currentPrice) * 100;
  
  return {
    predicted_price: consensusPrice,
    price_change_percent: priceChange,
    direction: consensusDirection,
    confidence: avgConfidence,
    upvotes,
    downvotes,
    neutral,
    agreement_level: Math.max(upvotes, downvotes, neutral) / aiPredictions.length
  };
}

/**
 * メイン予測エンジン
 */
export async function predictStockPrice(symbol, horizon = '3months', enableAI = true) {
  try {
    console.log(`[PREDICTION ENGINE] Starting prediction for ${symbol} (${horizon}, AI=${enableAI})`);
    
    // 1. 株価データ取得
    const { getStockQuote } = await import('../collectors/yahoo-finance.js');
    const stockData = await getStockQuote(symbol);
    
    if (!stockData) {
      throw new Error(`Failed to fetch stock data for ${symbol}`);
    }
    
    const currentPrice = stockData.regularMarketPrice;
    console.log(`[PREDICTION ENGINE] Current price: $${currentPrice}`);
    
    // 2. テクニカル指標計算
    const technicalData = await calculateTechnicalIndicators(symbol);
    
    if (!technicalData) {
      console.warn(`[PREDICTION ENGINE] Using current price data only (no historical data)`);
    }
    
    // 3. AI予測取得
    let aiPredictions = [];
    
    if (enableAI) {
      aiPredictions = await get4AIPredictions(symbol, stockData, technicalData || {}, horizon);
    } else {
      aiPredictions = generateMockPredictions(symbol, currentPrice, horizon);
    }
    
    // 4. コンセンサス生成
    const consensus = generateConsensus(aiPredictions, currentPrice);
    
    // 5. 結果をまとめる
    const result = {
      symbol,
      horizon,
      timestamp: new Date().toISOString(),
      current_price: currentPrice,
      technical_indicators: technicalData ? {
        rsi: technicalData.rsi,
        macd: technicalData.macd?.value,
        bb_position: technicalData.bb ? 
          ((currentPrice - technicalData.bb.lower) / (technicalData.bb.upper - technicalData.bb.lower)) : null,
        trend: technicalData.sma20 && technicalData.sma50 ? 
          (technicalData.sma20 > technicalData.sma50 ? 'bullish' : 'bearish') : null
      } : null,
      ai_predictions: aiPredictions,
      consensus,
      metadata: {
        ai_enabled: enableAI,
        ai_responses: aiPredictions.length,
        company_name: stockData.shortName || stockData.longName
      }
    };
    
    console.log(`[PREDICTION ENGINE] Prediction completed:`, {
      symbol,
      consensus_price: consensus.predicted_price.toFixed(2),
      direction: consensus.direction,
      confidence: (consensus.confidence * 100).toFixed(1) + '%'
    });
    
    return result;
    
  } catch (error) {
    console.error(`[PREDICTION ENGINE] Error:`, error.message);
    throw error;
  }
}

/**
 * バッチ予測（複数銘柄）
 */
export async function predictMultipleStocks(symbols, horizon = '3months', enableAI = true) {
  console.log(`[PREDICTION ENGINE] Batch prediction for ${symbols.length} symbols`);
  
  const results = [];
  
  for (const symbol of symbols) {
    try {
      const prediction = await predictStockPrice(symbol, horizon, enableAI);
      results.push(prediction);
      
      // API レート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`[PREDICTION ENGINE] Failed to predict ${symbol}:`, error.message);
      results.push({
        symbol,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return results;
}
