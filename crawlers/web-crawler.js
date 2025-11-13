const fetch = require('node-fetch');
const cheerio = require('cheerio');

class WebCrawler {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  // 企業のIRページをクロール
  async crawlIRPage(companyName, symbol) {
    const sources = [];
    
    try {
      // Google検索で企業IRページを探す
      const searchQuery = `${companyName} ${symbol} investor relations`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      console.log(`🔍 Searching IR pages for ${companyName}...`);
      
      // 実際の実装では、企業の公式IRページURLを直接使うか、
      // より信頼性の高いAPIを使用します
      
      // サンプル: 主要な情報源
      const irSources = [
        { name: 'Yahoo Finance News', url: `https://finance.yahoo.com/quote/${symbol}/news` },
        { name: 'Google Finance', url: `https://www.google.com/finance/quote/${symbol}` },
        { name: 'IR Official', url: `(企業公式IR)` }
      ];
      
      for (const source of irSources) {
        sources.push({
          source: source.name,
          url: source.url,
          status: 'pending'
        });
      }
      
      return {
        company: companyName,
        symbol,
        sources,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Crawler error:', error.message);
      return { error: error.message, sources: [] };
    }
  }

  // ニュース記事をクロール
  async crawlNews(symbol) {
    try {
      console.log(`📰 Crawling news for ${symbol}...`);
      
      // Google News検索
      const newsUrl = `https://news.google.com/search?q=${symbol}+stock+earnings+financial`;
      
      // 実装では実際にクロールするが、ここではサンプル
      return {
        articles: [
          {
            title: `${symbol} Q3 Earnings Beat Expectations`,
            source: 'Financial Times',
            date: new Date().toISOString(),
            summary: 'Sample news content...'
          }
        ]
      };
      
    } catch (error) {
      console.error('News crawler error:', error.message);
      return { articles: [] };
    }
  }

  // HTMLから重要情報を抽出
  async extractContent(url) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // タイトルとメインコンテンツを抽出
      const title = $('title').text();
      const content = $('article, main, .content').text().trim();
      
      return {
        url,
        title,
        content: content.substring(0, 5000), // 最大5000文字
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Content extraction error:', error.message);
      return null;
    }
  }
}

module.exports = WebCrawler;
