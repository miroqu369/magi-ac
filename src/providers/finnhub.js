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
