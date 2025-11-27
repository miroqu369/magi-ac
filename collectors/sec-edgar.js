/**
 * SEC EDGAR Collector
 * 13F報告書データ取得モジュール
 */

import axios from 'axios';

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_USER_AGENT = 'MAGI-AC v3.1 (contact@magi-system.com)'; // SEC requires User-Agent

// Major institutional investors CIK codes
const MAJOR_INSTITUTIONS = {
  'BLACKROCK': '0001086364',
  'VANGUARD': '0000102909',
  'STATE_STREET': '0000093751',
  'FIDELITY': '0000315066',
  'JPMORGAN': '0000019617',
  'BANK_OF_AMERICA': '0000070858',
  'CITADEL': '0001423053',
  'BRIDGEWATER': '0001350694'
};

/**
 * CIKコードから機関投資家のサブミッションデータを取得
 */
export async function getInstitutionSubmissions(cik) {
  try {
    const paddedCik = cik.padStart(10, '0');
    const url = `${SEC_BASE_URL}/submissions/CIK${paddedCik}.json`;
    
    console.log(`[SEC] Fetching submissions for CIK ${paddedCik}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': SEC_USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    return response.data;

  } catch (error) {
    console.error(`[SEC] Failed to fetch submissions for CIK ${cik}:`, error.message);
    throw error;
  }
}

/**
 * ティッカーシンボルからCIKを取得
 */
export async function getCIKFromTicker(ticker) {
  try {
    console.log(`[SEC] Fetching CIK for ticker ${ticker}`);
    
    const response = await axios.get(`${SEC_BASE_URL}/files/company_tickers.json`, {
      headers: {
        'User-Agent': SEC_USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const companies = Object.values(response.data);
    const company = companies.find(c => 
      c.ticker.toLowerCase() === ticker.toLowerCase()
    );

    if (company) {
      return String(company.cik_str).padStart(10, '0');
    }

    throw new Error(`CIK not found for ticker ${ticker}`);

  } catch (error) {
    console.error(`[SEC] Failed to get CIK for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * 13F報告書の最新ホールディングスを取得
 */
export async function get13FHoldings(cik) {
  try {
    const submissions = await getInstitutionSubmissions(cik);
    
    // 13F-HR (Holdings Report) を検索
    const filings = submissions.filings?.recent;
    if (!filings) {
      throw new Error('No filings found');
    }

    const form13FIndex = filings.form.findIndex(f => f === '13F-HR' || f === '13F-HR/A');
    
    if (form13FIndex === -1) {
      throw new Error('No 13F-HR filings found');
    }

    return {
      filingDate: filings.filingDate[form13FIndex],
      reportDate: filings.reportDate[form13FIndex],
      accessionNumber: filings.accessionNumber[form13FIndex],
      primaryDocument: filings.primaryDocument[form13FIndex],
      institution: submissions.name
    };

  } catch (error) {
    console.error(`[SEC] Failed to get 13F holdings:`, error.message);
    return null;
  }
}

/**
 * 特定銘柄に対する機関投資家のポジション変動を分析
 */
export async function analyzeInstitutionalChanges(ticker) {
  try {
    console.log(`[SEC] Analyzing institutional changes for ${ticker}`);
    
    const results = [];
    
    // 主要機関投資家の13Fデータを並列取得
    const promises = Object.entries(MAJOR_INSTITUTIONS).map(async ([name, cik]) => {
      try {
        const holdings = await get13FHoldings(cik);
        if (holdings) {
          return {
            institution: name,
            ...holdings
          };
        }
      } catch (err) {
        console.error(`[SEC] Failed for ${name}:`, err.message);
      }
      return null;
    });

    const settled = await Promise.allSettled(promises);
    const successful = settled
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    return {
      ticker: ticker.toUpperCase(),
      analyzedInstitutions: successful.length,
      lastUpdate: new Date().toISOString(),
      holdings: successful
    };

  } catch (error) {
    console.error(`[SEC] Analysis failed for ${ticker}:`, error.message);
    return {
      ticker: ticker.toUpperCase(),
      error: error.message,
      holdings: []
    };
  }
}

/**
 * 13F変動から異常なアクティビティを検出
 */
export function detectUnusualActivity(historicalHoldings) {
  const unusual = [];
  
  if (!historicalHoldings || historicalHoldings.length < 2) {
    return unusual;
  }

  for (let i = 0; i < historicalHoldings.length - 1; i++) {
    const current = historicalHoldings[i];
    const previous = historicalHoldings[i + 1];
    
    // ポジション変動率を計算
    const changePercent = previous.shares 
      ? ((current.shares - previous.shares) / previous.shares) * 100
      : 0;

    // 50%以上の変動は異常
    if (Math.abs(changePercent) > 50) {
      unusual.push({
        institution: current.institution,
        changePercent: changePercent.toFixed(2),
        action: changePercent > 0 ? 'INCREASED' : 'DECREASED',
        currentShares: current.shares,
        previousShares: previous.shares,
        filingDate: current.filingDate
      });
    }
  }

  return unusual;
}

/**
 * 機関投資家の集中度を計算
 */
export function calculateInstitutionalConcentration(holdings, totalSharesOutstanding) {
  if (!holdings || holdings.length === 0 || !totalSharesOutstanding) {
    return {
      concentration: 0,
      topInstitutionsPercentage: 0
    };
  }

  const totalInstitutionalShares = holdings.reduce((sum, h) => sum + (h.shares || 0), 0);
  const concentration = (totalInstitutionalShares / totalSharesOutstanding) * 100;

  // Top 5機関の保有率
  const sorted = [...holdings].sort((a, b) => (b.shares || 0) - (a.shares || 0));
  const top5Shares = sorted.slice(0, 5).reduce((sum, h) => sum + (h.shares || 0), 0);
  const topInstitutionsPercentage = (top5Shares / totalSharesOutstanding) * 100;

  return {
    concentration: concentration.toFixed(2),
    topInstitutionsPercentage: topInstitutionsPercentage.toFixed(2),
    totalInstitutionalShares,
    topInstitutions: sorted.slice(0, 5).map(h => ({
      name: h.institution,
      shares: h.shares,
      percentage: ((h.shares / totalSharesOutstanding) * 100).toFixed(2)
    }))
  };
}

/**
 * Mock data generator for development
 */
export function generateMock13FData(ticker) {
  const institutions = Object.keys(MAJOR_INSTITUTIONS);
  
  return {
    ticker: ticker.toUpperCase(),
    analyzedInstitutions: institutions.length,
    lastUpdate: new Date().toISOString(),
    holdings: institutions.map(name => ({
      institution: name,
      filingDate: '2025-11-15',
      reportDate: '2025-09-30',
      accessionNumber: '0001234567-25-000001',
      shares: Math.floor(Math.random() * 50000000),
      value: Math.floor(Math.random() * 10000000000),
      changeFromPreviousQuarter: (Math.random() * 40 - 20).toFixed(2) + '%'
    }))
  };
}
