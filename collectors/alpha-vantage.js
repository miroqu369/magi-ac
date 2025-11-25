import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

/**
 * Get real-time quote for a symbol
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<Object>} Quote data
 */
export async function getQuote(symbol) {
  try {
    console.log(`[ALPHA_VANTAGE] Fetching quote for ${symbol}`);
    
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: ALPHA_VANTAGE_API_KEY
      },
      timeout: 10000
    });

    const quote = response.data['Global Quote'];
    
    if (!quote || Object.keys(quote).length === 0) {
      throw new Error('No quote data returned');
    }

    return {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      previousClose: parseFloat(quote['08. previous close']),
      change: parseFloat(quote['09. change']),
      changePercent: quote['10. change percent'],
      volume: parseInt(quote['06. volume']),
      latestTradingDay: quote['07. latest trading day'],
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      open: parseFloat(quote['02. open'])
    };

  } catch (error) {
    console.error(`[ALPHA_VANTAGE] Error fetching quote for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get daily time series data (for historical analysis)
 * @param {string} symbol - Stock symbol
 * @param {boolean} compact - If true, returns last 100 data points (default: true)
 * @returns {Promise<Array>} Array of daily price data
 */
export async function getDailyTimeSeries(symbol, compact = true) {
  try {
    console.log(`[ALPHA_VANTAGE] Fetching daily time series for ${symbol}`);
    
    const response = await axios.get(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol: symbol,
        outputsize: compact ? 'compact' : 'full',
        apikey: ALPHA_VANTAGE_API_KEY
      },
      timeout: 15000
    });

    const timeSeries = response.data['Time Series (Daily)'];
    
    if (!timeSeries) {
      throw new Error('No time series data returned');
    }

    // Convert to array format
    const dailyData = Object.entries(timeSeries).map(([date, data]) => ({
      date: date,
      open: parseFloat(data['1. open']),
      high: parseFloat(data['2. high']),
      low: parseFloat(data['3. low']),
      close: parseFloat(data['4. close']),
      volume: parseInt(data['5. volume'])
    }));

    // Sort by date (most recent first)
    dailyData.sort((a, b) => new Date(b.date) - new Date(a.date));

    return dailyData;

  } catch (error) {
    console.error(`[ALPHA_VANTAGE] Error fetching time series for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Calculate technical indicators from historical data
 * @param {Array} dailyData - Array of daily price data
 * @returns {Object} Technical indicators
 */
export function calculateIndicators(dailyData) {
  if (!dailyData || dailyData.length < 14) {
    throw new Error('Insufficient data for technical indicators (need at least 14 days)');
  }

  // Calculate RSI (14 period)
  const rsi = calculateRSI(dailyData, 14);
  
  // Calculate moving averages
  const sma50 = calculateSMA(dailyData, 50);
  const sma200 = calculateSMA(dailyData, 200);
  
  return {
    rsi: rsi,
    sma50: sma50,
    sma200: sma200,
    latestClose: dailyData[0].close,
    latestDate: dailyData[0].date
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

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain/loss
  for (let i = 0; i < period; i++) {
    const change = data[i].close - data[i + 1].close;
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

  const sum = data.slice(0, period).reduce((acc, day) => acc + day.close, 0);
  return parseFloat((sum / period).toFixed(2));
}

/**
 * Get comprehensive stock data (quote + historical + indicators)
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Comprehensive stock data
 */
export async function getComprehensiveData(symbol) {
  try {
    console.log(`[ALPHA_VANTAGE] Fetching comprehensive data for ${symbol}`);
    
    // Fetch both quote and historical data
    const [quote, timeSeries] = await Promise.all([
      getQuote(symbol),
      getDailyTimeSeries(symbol, true)
    ]);

    // Calculate technical indicators
    const indicators = calculateIndicators(timeSeries);

    return {
      symbol: symbol,
      quote: quote,
      timeSeries: timeSeries.slice(0, 30), // Last 30 days
      indicators: indicators,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[ALPHA_VANTAGE] Error fetching comprehensive data for ${symbol}:`, error.message);
    throw error;
  }
}
