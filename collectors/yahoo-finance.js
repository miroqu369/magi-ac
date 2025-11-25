import axios from 'axios';

const YAHOO_FINANCE_API = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const YAHOO_CHART_API = 'https://query2.finance.yahoo.com/v8/finance/chart';

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
  fiftyTwoWeekLow: Math.random() * 100 + 30
});

export async function getStockQuote(symbol) {
  try {
    console.log(`[YAHOO] Fetching quote for ${symbol}`);
    
    const response = await axios.get(YAHOO_FINANCE_API + '/' + symbol, {
      params: {
        modules: 'price,summaryDetail,defaultKeyStatistics,financialData'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    if (response.data?.quoteSummary?.result?.[0]) {
      const result = response.data.quoteSummary.result[0];
      
      return {
        shortName: result.price?.shortName,
        longName: result.price?.longName,
        regularMarketPrice: result.price?.regularMarketPrice?.raw,
        regularMarketPreviousClose: result.price?.regularMarketPreviousClose?.raw,
        marketCap: result.price?.marketCap?.raw,
        trailingPE: result.summaryDetail?.trailingPE?.raw,
        epsTrailingTwelveMonths: result.defaultKeyStatistics?.trailingEps?.raw,
        totalRevenue: result.financialData?.totalRevenue?.raw,
        profitMargins: result.financialData?.profitMargins?.raw,
        debtToEquity: result.financialData?.debtToEquity?.raw,
        fiftyDayAverage: result.summaryDetail?.fiftyDayAverage?.raw,
        twoHundredDayAverage: result.summaryDetail?.twoHundredDayAverage?.raw,
        fiftyTwoWeekHigh: result.summaryDetail?.fiftyTwoWeekHigh?.raw,
        fiftyTwoWeekLow: result.summaryDetail?.fiftyTwoWeekLow?.raw
      };
    }

    throw new Error('No data in response');

  } catch (error) {
    console.error(`[YAHOO] API failed for ${symbol}:`, error.message);
    console.log('[YAHOO] Using mock data as fallback');
    return getMockQuote(symbol);
  }
}

export async function getHistoricalData(symbol, days = 100) {
  try {
    console.log(`[YAHOO] Fetching ${days} days historical data for ${symbol}`);
    
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (days * 24 * 60 * 60);
    
    const response = await axios.get(`${YAHOO_CHART_API}/${symbol}`, {
      params: {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const result = response.data?.chart?.result?.[0];
    if (!result) {
      throw new Error('No chart data');
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quotes.open[i],
      high: quotes.high[i],
      low: quotes.low[i],
      close: quotes.close[i],
      volume: quotes.volume[i]
    })).filter(d => d.close !== null);

  } catch (error) {
    console.error(`[YAHOO] Historical data failed for ${symbol}:`, error.message);
    return generateMockHistoricalData(days);
  }
}

export async function getComprehensiveData(symbol) {
  const [quote, historical] = await Promise.all([
    getStockQuote(symbol),
    getHistoricalData(symbol, 100)
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
