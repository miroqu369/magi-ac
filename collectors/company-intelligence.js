'use strict';
const axios = require('axios');

class CompanyIntelligence {
  constructor() {
    this.finnhubKey = process.env.FINNHUB_API_KEY || 'demo';
  }

  async getCompanyProfile(symbol) {
    try {
      const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${this.finnhubKey}`;
      const resp = await axios.get(url, { timeout: 5000 });
      return {
        symbol,
        name: resp.data.name || symbol,
        industry: resp.data.finnhubIndustry || 'Unknown',
        country: resp.data.country || 'US',
        website: resp.data.weburl || ''
      };
    } catch (e) {
      return { symbol, name: symbol, industry: 'Unknown' };
    }
  }

  async getLatestNews(symbol, days = 7) {
    try {
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&token=${this.finnhubKey}`;
      const resp = await axios.get(url, { timeout: 5000 });
      return (resp.data || []).slice(0, 5).map(n => ({
        headline: n.headline,
        summary: n.summary.substring(0, 150),
        source: n.source
      }));
    } catch (e) {
      return [];
    }
  }

  async generateIntelligencePoints(symbol, financialData, news) {
    return [
      { type: 'news', positive: true, text: 'Analysis available', weight: 0.1 }
    ];
  }
}

module.exports = CompanyIntelligence;
