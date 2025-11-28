import yahooFinance from 'yahoo-finance2';

const getMockQuote = (symbol) => ({
  shortName: `${symbol} Inc.`,
  longName: `${symbol} Corporation`,
  regularMarketPrice: Math.random() * 200 + 50,
  regularMarketPreviousClose: Math.random() * 200 + 50,
  marketCap: Math.floor(Math.random() * 1000000000000),
  trailingPE: Math.random() * 30 + 10,
  epsTrailingTwelveMonths: Math.random() * 10,
  totalRevenue: Math.floor(Math.random() * 500000000000),
  profitMargins: Math.random() * 0.3,
  debtToEquity: Math.random() * 2,
  fiftyDayAverage: Math.random() * 200 + 50,
  twoHundredDayAverage: Math.random() * 200 + 50,
  fiftyTwoWeekHigh: Math.random() * 250 + 100,
  fiftyTwoWeekLow: Math.random() * 100 + 30,
  regularMarketVolume: Math.floor(Math.random() * 100000000),
  averageVolume: Math.floor(Math.random() * 100000000)
});

export async function getStockQuote(symbol) {
  try {
    console.log(`[YAHOO] Fetching quote for ${symbol}`);
    
    // Use yahoo-finance2 quoteSummary
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData']
    });
    
    const price = result.price;
    const summaryDetail = result.summaryDetail;
    const keyStats = result.defaultKeyStatistics;
    const financial = result.financialData;
    
    return {
      shortName: price?.shortName || price?.longName,
      longName: price?.longName || price?.shortName,
      regularMarketPrice: price?.regularMarketPrice,
      regularMarketPreviousClose: price?.regularMarketPreviousClose,
      marketCap: price?.marketCap,
      trailingPE: summaryDetail?.trailingPE,
      epsTrailingTwelveMonths: keyStats?.trailingEps,
      totalRevenue: financial?.totalRevenue,
      profitMargins: financial?.profitMargins,
      debtToEquity: financial?.debtToEquity,
      fiftyDayAverage: summaryDetail?.fiftyDayAverage,
      twoHundredDayAverage: summaryDetail?.twoHundredDayAverage,
      fiftyTwoWeekHigh: summaryDetail?.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: summaryDetail?.fiftyTwoWeekLow,
      regularMarketVolume: price?.regularMarketVolume,
      averageVolume: summaryDetail?.averageVolume || summaryDetail?.averageDailyVolume10Day
    };

  } catch (error) {
    console.error(`[YAHOO] API failed for ${symbol}:`, error.message);
    console.log('[YAHOO] Using mock data as fallback');
    return getMockQuote(symbol);
  }
}

export async function getHistoricalData(symbol, period = '60d') {
  try {
    console.log(`[YAHOO] Fetching historical data for ${symbol} (${period})`);
    
    // Convert period string to date range
    const endDate = new Date();
    const startDate = new Date();
    
    const periodNum = parseInt(period);
    startDate.setDate(startDate.getDate() - periodNum);
    
    // Use yahoo-finance2 chart method
    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error('No historical data');
    }
    
    return result.quotes.map(q => ({
      date: q.date.toISOString().split('T')[0],
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume
    }));

  } catch (error) {
    console.error(`[YAHOO] Historical data failed for ${symbol}:`, error.message);
    const periodNum = parseInt(period) || 60;
    return generateMockHistoricalData(periodNum);
  }
}

export async function getComprehensiveData(symbol) {
  const [quote, historical] = await Promise.all([
    getStockQuote(symbol),
    getHistoricalData(symbol, '100d')
  ]);

  const indicators = calculateIndicators(historical);

  return {
    symbol,
    quote: {
      price: quote.regularMarketPrice,
      previousClose: quote.regularMarketPreviousClose,
      change: quote.regularMarketPrice - quote.regularMarketPreviousClose,
      changePercent: ((quote.regularMarketPrice - quote.regularMarketPreviousClose) / quote.regularMarketPreviousClose * 100).toFixed(2) + '%'
    },
    timeSeries: historical.slice(0, 30),
    indicators,
    timestamp: new Date().toISOString()
  };
}

function calculateIndicators(historical) {
  if (historical.length < 14) {
    return { rsi: 50, sma50: null, sma200: null };
  }

  const rsi = calculateRSI(historical, 14);
  const sma50 = calculateSMA(historical, 50);
  const sma200 = calculateSMA(historical, 200);

  return { rsi, sma50, sma200 };
}

function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return 50;

  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    const change = data[i].close - data[i + 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return parseFloat((100 - (100 / (1 + rs))).toFixed(2));
}

function calculateSMA(data, period) {
  if (data.length < period) return null;
  const sum = data.slice(0, period).reduce((acc, d) => acc + d.close, 0);
  return parseFloat((sum / period).toFixed(2));
}

/**
 * 分足データ取得 (1分・5分・15分)
 */
export async function getIntradayData(symbol, interval = '1m', days = 1) {
  try {
    console.log(`[YAHOO] Fetching ${interval} intraday data for ${symbol}`);
    
    const validIntervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'];
    if (!validIntervals.includes(interval)) {
      throw new Error(`Invalid interval: ${interval}`);
    }
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Use yahoo-finance2 chart method
    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: interval
    });
    
    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error('No intraday data');
    }
    
    return result.quotes.map(q => ({
      timestamp: q.date.toISOString(),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume
    }));

  } catch (error) {
    console.error(`[YAHOO] Intraday data failed for ${symbol}:`, error.message);
    return generateMockIntradayData(interval, days);
  }
}

function generateMockHistoricalData(days) {
  const data = [];
  let price = 150;
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    price += (Math.random() - 0.5) * 10;
    data.push({
      date: date.toISOString().split('T')[0],
      open: price,
      high: price * 1.02,
      low: price * 0.98,
      close: price,
      volume: Math.floor(Math.random() * 10000000)
    });
  }
  return data;
}

function generateMockIntradayData(interval, days) {
  const data = [];
  let price = 150;
  const minutesPerDay = 390; // 市場開場時間 (6.5時間)
  const intervalMinutes = parseInt(interval);
  const pointsPerDay = minutesPerDay / intervalMinutes;
  const totalPoints = pointsPerDay * days;
  
  for (let i = 0; i < totalPoints; i++) {
    const timestamp = new Date(Date.now() - (totalPoints - i) * intervalMinutes * 60 * 1000);
    price += (Math.random() - 0.5) * 2;
    data.push({
      timestamp: timestamp.toISOString(),
      open: price,
      high: price * 1.005,
      low: price * 0.995,
      close: price,
      volume: Math.floor(Math.random() * 100000)
    });
  }
  return data;
}
