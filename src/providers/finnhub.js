const axios = require('axios');

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = process.env.FINNHUB_API_KEY || 'demo';

async function getStockData(symbol) {
  try {
    const res = await axios.get(`${BASE_URL}/quote`, {
      params: { symbol, token: API_KEY }
    });
    
    console.log(`[Finnhub] ${symbol} データ取得成功`);
    
    return {
      symbol: symbol.toUpperCase(),
      currentPrice: res.data.c || 0,
      previousClose: res.data.pc || 0,
      high52week: res.data.h || 0,
      low52week: res.data.l || 0
    };
  } catch (error) {
    console.error(`[Finnhub] ${symbol} エラー:`, error.message);
    return null;
  }
}

module.exports = { getStockData };

// OHLC データ取得（テクニカル分析用）
async function getOHLCData(symbol, days = 30) {
  try {
    const from = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
    const to = Math.floor(Date.now() / 1000);
    
    const res = await axios.get(`${BASE_URL}/candle`, {
      params: { 
        symbol, 
        resolution: 'D',  // 日足
        from, 
        to, 
        token: API_KEY 
      }
    });

    console.log(`[Finnhub] ${symbol} OHLC データ取得 - ${res.data.c.length}日分`);

    return {
      symbol: symbol.toUpperCase(),
      closes: res.data.c || [],      // Close prices
      opens: res.data.o || [],       // Open prices
      highs: res.data.h || [],       // High prices
      lows: res.data.l || [],        // Low prices
      volumes: res.data.v || [],     // Volumes
      timestamps: res.data.t || []   // Timestamps
    };
  } catch (error) {
    console.error(`[Finnhub] OHLC エラー for ${symbol}:`, error.message);
    return null;
  }
}

module.exports.getOHLCData = getOHLCData;
