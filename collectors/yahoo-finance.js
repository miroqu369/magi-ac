'use strict';
const axios = require('axios');

class YahooFinanceCollector {
  async getQuote(symbol) {
    const mockData = {
      'AAPL': { price: 225.50, company: 'Apple Inc.' },
      'GOOGL': { price: 140.25, company: 'Alphabet Inc.' },
      'MSFT': { price: 380.50, company: 'Microsoft Corp.' }
    };
    
    const d = mockData[symbol.toUpperCase()] || { price: 100, company: symbol };
    
    return {
      symbol: symbol.toUpperCase(),
      company: d.company,
      timestamp: new Date().toISOString(),
      financialData: {
        currentPrice: d.price,
        previousClose: d.price - 1,
        marketCap: 1000000000000,
        pe: 25,
        eps: 5
      }
    };
  }
}

module.exports = YahooFinanceCollector;
