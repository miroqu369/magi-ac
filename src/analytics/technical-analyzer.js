import axios from 'axios';

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY || 'demo';

// モックデータ（テスト用）
function generateMockOHLCData(symbol) {
  const basePrice = Math.random() * 150 + 100;
  const closes = [];
  let price = basePrice;

  for (let i = 0; i < 30; i++) {
    const change = (Math.random() - 0.5) * 5;
    price += change;
    closes.push(parseFloat(price.toFixed(2)));
  }

  return {
    symbol: symbol.toUpperCase(),
    closes,
    opens: closes.map(c => c - 1),
    highs: closes.map(c => c + 2),
    lows: closes.map(c => c - 2),
    volumes: Array(30).fill(1000000),
    timestamps: Array(30).fill(0)
  };
}

// Quote データ取得（実データ）
async function getQuoteData(symbol) {
  try {
    const res = await axios.get(`${BASE_URL}/quote`, {
      params: { symbol, token: API_KEY }
    });

    return {
      symbol: symbol.toUpperCase(),
      currentPrice: res.data.c || 0,
      previousClose: res.data.pc || 0,
      high: res.data.h || 0,
      low: res.data.l || 0
    };
  } catch (error) {
    console.error(`[Finnhub] Quote error for ${symbol}:`, error.message);
    return null;
  }
}

// OHLC データ取得（モック）
async function getOHLCData(symbol) {
  console.log(`[Technical] Using mock OHLC data for ${symbol}`);
  return generateMockOHLCData(symbol);
}

// RSI を計算
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// EMA を計算
function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  
  for (let i = 1; i < values.length; i++) {
    ema = (values[i] * k) + (ema * (1 - k));
  }
  
  return ema;
}

// MACD を計算
function calculateMACD(closes) {
  if (closes.length < 26) return null;
  
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const signalLine = calculateEMA([macdLine], 9);
  const histogram = macdLine - signalLine;
  
  return { macdLine, signalLine, histogram };
}

// Bollinger Bands を計算
function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  if (closes.length < period) return null;
  
  const recentCloses = closes.slice(-period);
  const sma = recentCloses.reduce((a, b) => a + b) / period;
  
  const variance = recentCloses.reduce((sum, close) => {
    return sum + Math.pow(close - sma, 2);
  }, 0) / period;
  
  const std = Math.sqrt(variance);
  
  return {
    upper: sma + (std * stdDev),
    middle: sma,
    lower: sma - (std * stdDev)
  };
}

// テクニカル分析を実行
export async function analyzeSymbol(symbol) {
  try {
    // Quote データと OHLC データを並列取得
    const quoteData = await getQuoteData(symbol);
    const ohlcData = await getOHLCData(symbol);
    
    if (!ohlcData || ohlcData.closes.length === 0) {
      console.warn(`[Technical] No OHLC data for ${symbol}`);
      return null;
    }

    const closes = ohlcData.closes;
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const currentPrice = quoteData ? quoteData.currentPrice : closes[closes.length - 1];

    return {
      symbol,
      currentPrice: parseFloat(currentPrice).toFixed(2),
      dataSource: quoteData ? 'Finnhub Real Data' : 'Mock Data',
      indicators: {
        rsi: rsi ? rsi.toFixed(2) : null,
        macd: macd ? {
          line: macd.macdLine.toFixed(4),
          signal: macd.signalLine.toFixed(4),
          histogram: macd.histogram.toFixed(4)
        } : null,
        bollingerBands: bb ? {
          upper: bb.upper.toFixed(2),
          middle: bb.middle.toFixed(2),
          lower: bb.lower.toFixed(2)
        } : null
      },
      signals: {
        rsiSignal: rsi ? (rsi < 30 ? 'OVERSOLD' : rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL') : null,
        bbSignal: bb && currentPrice ? (
          currentPrice > bb.upper ? 'OVERBOUGHT' : 
          currentPrice < bb.lower ? 'OVERSOLD' : 'NEUTRAL'
        ) : null,
        macdSignal: macd ? (macd.histogram > 0 ? 'BULLISH' : 'BEARISH') : null
      }
    };
  } catch (error) {
    console.error(`[Technical] Analysis error for ${symbol}:`, error.message);
    return null;
  }
}
