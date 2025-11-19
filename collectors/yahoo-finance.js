'use strict';
const YahooFinance = require('yahoo-finance2').default;

class YahooFinanceCollector {
  constructor() {
    this.yf = new YahooFinance();
  }

  async getQuote(symbol) {
    try {
      console.log('[YahooFinance] データ取得開始: ' + symbol);
      
      // シンプルに quote を呼び出し
      const quote = await this.yf.quote(symbol);

      const result = {
        symbol: symbol.toUpperCase(),
        company: quote.longName || quote.shortName || symbol,
        timestamp: new Date().toISOString(),
        fetchDate: new Date().toISOString().split('T')[0],
        financialData: {
          currentPrice: quote.regularMarketPrice || null,
          previousClose: quote.regularMarketPreviousClose || null,
          per: quote.trailingPE || null,
          eps: quote.trailingEps || null,
          dividendYield: quote.dividendYield || null,
          marketCap: quote.marketCap || null,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || null,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow || null,
          currency: quote.currency || 'USD',
          exchange: quote.exchange || null,
          dataSource: 'yahoo-finance'
        },
        priceChange: {
          absolute: (quote.regularMarketPrice || 0) - (quote.regularMarketPreviousClose || 0),
          percent: quote.regularMarketChangePercent || null
        }
      };

      console.log('[YahooFinance] 取得完了: ' + symbol);
      return result;

    } catch (error) {
      console.error('[YahooFinance] エラー: ' + symbol, error.message);
      throw new Error('Yahoo Finance 取得失敗: ' + error.message);
    }
  }

  async getMultipleSymbols(symbols) {
    const results = [];
    for (const symbol of symbols) {
      try {
        const data = await this.getQuote(symbol);
        results.push(data);
      } catch (error) {
        console.warn('取得失敗: ' + symbol);
      }
    }
    return results;
  }
}

module.exports = YahooFinanceCollector;
