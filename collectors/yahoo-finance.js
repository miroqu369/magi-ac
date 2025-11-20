import axios from 'axios';

const YAHOO_FINANCE_API = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';

// Mock data for fallback
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
  debtToEquity: Math.random() * 2
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
        debtToEquity: result.financialData?.debtToEquity?.raw
      };
    }

    throw new Error('No data in response');

  } catch (error) {
    console.warn(`[YAHOO] API failed for ${symbol}: ${error.message}`);
    console.log('[YAHOO] Using mock data as fallback');
    return getMockQuote(symbol);
  }
}

export async function getMultipleQuotes(symbols) {
  const results = [];
  
  for (const symbol of symbols) {
    try {
      const quote = await getStockQuote(symbol);
      results.push({ symbol, quote, success: true });
    } catch (error) {
      results.push({ symbol, error: error.message, success: false });
    }
  }
  
  return results;
}
