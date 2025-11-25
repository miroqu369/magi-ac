import { YahooFinance } from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

/**
 * Get comprehensive stock data using yahoo-finance2
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<Object>} Comprehensive stock data
 */
export async function getComprehensiveData(symbol) {
  try {
    console.log(`[YAHOO-FINANCE2] Fetching comprehensive data for ${symbol}`);
    
    // Fetch quote and historical data
    const [quote, historical] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.historical(symbol, {
        period1: getDateDaysAgo(100), // 100 days ago
        period2: new Date(),
        interval: '1d'
      })
    ]);

    // Calculate technical indicators
    const indicators = calculateIndicators(historical);

    return {
      symbol: symbol,
      quote: {
        price: quote.regularMarketPrice,
        previousClose: quote.regularMarketPreviousClose,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        volume: quote.regularMarketVolume,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        open: quote.regularMarketOpen
      },
      timeSeries: historical.slice(0, 30).map(h => ({
        date: h.date.toISOString().split('T')[0],
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: h.volume
      })),
      indicators: indicators,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[YAHOO-FINANCE2] Error fetching data for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get historical data
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days (default: 100)
 * @returns {Promise<Array>} Historical data
 */
export async function getDailyTimeSeries(symbol, days = 100) {
  try {
    console.log(`[YAHOO-FINANCE2] Fetching historical data for ${symbol}`);
    
    const historical = await yahooFinance.historical(symbol, {
      period1: getDateDaysAgo(days),
      period2: new Date(),
      interval: '1d'
    });

    return historical.map(h => ({
      date: h.date.toISOString().split('T')[0],
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume
    }));

  } catch (error) {
    console.error(`[YAHOO-FINANCE2] Error fetching historical data:`, error.message);
    throw error;
  }
}

/**
 * Calculate technical indicators from historical data
 * @param {Array} historicalData - Array of historical price data
 * @returns {Object} Technical indicators
 */
function calculateIndicators(historicalData) {
  if (!historicalData || historicalData.length < 14) {
    throw new Error('Insufficient data for technical indicators (need at least 14 days)');
  }

  // Calculate RSI (14 period)
  const rsi = calculateRSI(historicalData, 14);
  
  // Calculate moving averages
  const sma50 = calculateSMA(historicalData, 50);
  const sma200 = calculateSMA(historicalData, 200);
  
  return {
    rsi: rsi,
    sma50: sma50,
    sma200: sma200,
    latestClose: historicalData[historicalData.length - 1].close,
    latestDate: historicalData[historicalData.length - 1].date
  };
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array} data - Price data
 * @param {number} period - RSI period (default: 14)
 * @returns {number} RSI value
 */
function calculateRSI(data, period = 14) {
  if (data.length < period + 1) {
    return null;
  }

  // Reverse to get chronological order
  const reversedData = [...data].reverse();
  
  let gains = 0;
  let losses = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = reversedData[i].close - reversedData[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RSI
  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return parseFloat(rsi.toFixed(2));
}

/**
 * Calculate Simple Moving Average
 * @param {Array} data - Price data
 * @param {number} period - SMA period
 * @returns {number} SMA value
 */
function calculateSMA(data, period) {
  if (data.length < period) {
    return null;
  }

  // Get last 'period' days
  const recentData = data.slice(-period);
  const sum = recentData.reduce((acc, day) => acc + day.close, 0);
  return parseFloat((sum / period).toFixed(2));
}

/**
 * Helper function to get date N days ago
 * @param {number} days - Number of days ago
 * @returns {Date} Date object
 */
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
