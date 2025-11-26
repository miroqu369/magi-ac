import YahooFinance from 'yahoo-finance2';

// インスタンスを作成
const yahooFinance = new YahooFinance();

// Yahoo Finance からデータ取得
async function getStockData(symbol) {
  try {
    console.log(`[YahooFinance] データ取得開始: ${symbol}`);
    
    // 現在の株価
    const quote = await yahooFinance.quote(symbol);
    
    // 過去30日の履歴データ
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 45);
    
    const history = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    const closes = history.map(d => d.close);
    
    return {
      quote: {
        symbol: symbol.toUpperCase(),
        currentPrice: quote.regularMarketPrice || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        high: quote.regularMarketDayHigh || 0,
        low: quote.regularMarketDayLow || 0,
        company: quote.longName || quote.shortName || symbol
      },
      history: {
        closes,
        highs: history.map(d => d.high),
        lows: history.map(d => d.low),
        volumes: history.map(d => d.volume)
      }
    };
  } catch (error) {
    console.error(`[YahooFinance] Error for ${symbol}:`, error.message);
    return null;
  }
}

// RSI計算（14期間）
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// MACD計算
function calculateMACD(closes) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const signal = macdLine * 0.9;
  return {
    line: macdLine,
    signal: signal,
    histogram: macdLine - signal
  };
}

// EMA計算
function calculateEMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// ボリンジャーバンド計算
function calculateBollingerBands(closes, period = 20) {
  if (closes.length < period) {
    const price = closes[closes.length - 1] || 100;
    return { upper: price * 1.02, middle: price, lower: price * 0.98 };
  }
  
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: sma + stdDev * 2,
    middle: sma,
    lower: sma - stdDev * 2
  };
}

// シグナル判定
function getSignals(rsi, macd, bb, currentPrice) {
  let rsiSignal = 'NEUTRAL';
  if (rsi < 30) rsiSignal = 'OVERSOLD';
  else if (rsi > 70) rsiSignal = 'OVERBOUGHT';
  
  let bbSignal = 'NEUTRAL';
  if (currentPrice < bb.lower) bbSignal = 'OVERSOLD';
  else if (currentPrice > bb.upper) bbSignal = 'OVERBOUGHT';
  
  let macdSignal = macd.histogram > 0 ? 'BULLISH' : 'BEARISH';
  
  return { rsiSignal, bbSignal, macdSignal };
}

// メイン分析関数
export async function analyzeSymbol(symbol) {
  const data = await getStockData(symbol);
  
  if (!data) {
    console.log(`[Technical] Using mock data for ${symbol}`);
    const mockPrice = Math.random() * 100 + 100;
    return {
      symbol: symbol.toUpperCase(),
      currentPrice: mockPrice.toFixed(2),
      dataSource: 'Mock Data',
      indicators: {
        rsi: (Math.random() * 40 + 30).toFixed(2),
        macd: { line: '0.00', signal: '0.00', histogram: '0.00' },
        bollingerBands: {
          upper: (mockPrice * 1.05).toFixed(2),
          middle: mockPrice.toFixed(2),
          lower: (mockPrice * 0.95).toFixed(2)
        }
      },
      signals: { rsiSignal: 'NEUTRAL', bbSignal: 'NEUTRAL', macdSignal: 'NEUTRAL' }
    };
  }
  
  const closes = data.history.closes;
  const currentPrice = data.quote.currentPrice;
  
  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes);
  const signals = getSignals(rsi, macd, bb, currentPrice);
  
  return {
    symbol: symbol.toUpperCase(),
    company: data.quote.company,
    currentPrice: currentPrice.toFixed(2),
    previousClose: data.quote.previousClose.toFixed(2),
    dataSource: 'Yahoo Finance',
    indicators: {
      rsi: rsi.toFixed(2),
      macd: {
        line: macd.line.toFixed(4),
        signal: macd.signal.toFixed(4),
        histogram: macd.histogram.toFixed(4)
      },
      bollingerBands: {
        upper: bb.upper.toFixed(2),
        middle: bb.middle.toFixed(2),
        lower: bb.lower.toFixed(2)
      }
    },
    signals
  };
}
