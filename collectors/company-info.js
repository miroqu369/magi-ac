'use strict';
const axios = require('axios');

class CompanyInfoCollector {
  constructor() {
    this.finnhubKey = process.env.FINNHUB_API_KEY || 'test';
  }

  async getCompanyProfile(symbol) {
    try {
      console.log('[CompanyInfo] 企業情報取得開始: ' + symbol);
      
      // Finnhub API で企業プロフィール取得
      const response = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
        params: {
          symbol: symbol.toUpperCase(),
          token: this.finnhubKey
        },
        timeout: 10000
      });

      const data = response.data;

      return {
        symbol: symbol.toUpperCase(),
        company_name: data.name || symbol,
        industry: data.finnhubIndustry || 'Unknown',
        sector: data.naicsIndustryGroup || 'Unknown',
        country: data.country || 'Unknown',
        website: data.weburl || null,
        ipo_date: data.ipo || null,
        market_cap: data.marketCapitalization || null,
        employees: data.employees || null,
        phone: data.phone || null
      };

    } catch (error) {
      console.warn('[CompanyInfo] 取得失敗: ' + symbol, error.message);
      // エラーでも進む（基本情報だけは返す）
      return {
        symbol: symbol.toUpperCase(),
        company_name: symbol,
        industry: 'Unknown',
        sector: 'Unknown',
        country: 'Unknown',
        website: null
      };
    }
  }
}

module.exports = CompanyInfoCollector;
