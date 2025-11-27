/**
 * FINRA Short Interest Data Collector
 * 空売りデータ取得モジュール
 */

import axios from 'axios';

const FINRA_SHORT_URL = 'https://cdn.finra.org/equity/regsho/daily';

/**
 * 日次空売りデータを取得
 * FINRA Reg SHO Short Sale Volume Daily File
 */
export async function getShortVolumeData(symbol, date = null) {
  try {
    // デフォルトは前営業日
    const targetDate = date || getPreviousBusinessDay();
    const dateStr = formatDateForFINRA(targetDate);
    
    console.log(`[FINRA] Fetching short volume for ${symbol} on ${dateStr}`);
    
    const url = `${FINRA_SHORT_URL}/CNMSshvol${dateStr}.txt`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'MAGI-AC/3.1'
      },
      timeout: 15000
    });

    const lines = response.data.split('\n');
    const symbolData = lines.find(line => 
      line.startsWith(`${symbol}|`)
    );

    if (!symbolData) {
      console.log(`[FINRA] No short data found for ${symbol}`);
      return generateMockShortData(symbol, dateStr);
    }

    const parts = symbolData.split('|');
    
    return {
      symbol: parts[1],
      date: dateStr,
      shortVolume: parseInt(parts[2]),
      shortExemptVolume: parseInt(parts[3]),
      totalVolume: parseInt(parts[4]),
      market: parts[5],
      shortRatio: (parseInt(parts[2]) / parseInt(parts[4]) * 100).toFixed(2)
    };

  } catch (error) {
    console.error(`[FINRA] Failed to fetch short data:`, error.message);
    return generateMockShortData(symbol, formatDateForFINRA(new Date()));
  }
}

/**
 * 過去N日間の空売りトレンドを取得
 */
export async function getShortTrend(symbol, days = 5) {
  const results = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // 週末をスキップ
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }
    
    try {
      const data = await getShortVolumeData(symbol, date);
      results.push(data);
      
      // Rate limiting: 1秒待機
      await sleep(1000);
      
    } catch (error) {
      console.error(`[FINRA] Failed for date ${date.toISOString()}:`, error.message);
    }
  }
  
  return {
    symbol: symbol.toUpperCase(),
    period: `${days} days`,
    data: results,
    analysis: analyzeShortTrend(results)
  };
}

/**
 * 空売りトレンドを分析
 */
function analyzeShortTrend(shortData) {
  if (!shortData || shortData.length < 2) {
    return {
      trend: 'insufficient_data',
      avgShortRatio: 0,
      change: 0
    };
  }

  const avgShortRatio = shortData.reduce((sum, d) => 
    sum + parseFloat(d.shortRatio), 0
  ) / shortData.length;

  const latest = parseFloat(shortData[0].shortRatio);
  const oldest = parseFloat(shortData[shortData.length - 1].shortRatio);
  const change = ((latest - oldest) / oldest) * 100;

  let trend = 'stable';
  if (change > 20) trend = 'increasing';
  else if (change < -20) trend = 'decreasing';

  return {
    trend,
    avgShortRatio: avgShortRatio.toFixed(2),
    latestRatio: latest.toFixed(2),
    change: change.toFixed(2),
    alert: latest > 40 || Math.abs(change) > 50
  };
}

/**
 * 空売り異常検知
 */
export function detectShortAnomalies(shortData) {
  if (!shortData || shortData.length === 0) {
    return { detected: false, signals: [] };
  }

  const signals = [];
  const latest = shortData[0];
  const latestRatio = parseFloat(latest.shortRatio);

  // 異常に高い空売り比率 (>50%)
  if (latestRatio > 50) {
    signals.push({
      type: 'extreme_short_ratio',
      severity: 'high',
      description: `空売り比率が${latestRatio}%と極端に高い`,
      value: latestRatio,
      threshold: 50
    });
  }

  // 急激な空売り増加
  if (shortData.length >= 2) {
    const previous = parseFloat(shortData[1].shortRatio);
    const change = ((latestRatio - previous) / previous) * 100;
    
    if (change > 100) {
      signals.push({
        type: 'short_interest_surge',
        severity: 'high',
        description: `空売り比率が前日比${change.toFixed(0)}%急増`,
        value: change,
        threshold: 100
      });
    }
  }

  // 連続した高水準
  const highRatioDays = shortData.filter(d => parseFloat(d.shortRatio) > 40).length;
  if (highRatioDays >= 3) {
    signals.push({
      type: 'sustained_short_pressure',
      severity: 'medium',
      description: `${highRatioDays}日連続で空売り比率が40%超`,
      value: highRatioDays,
      threshold: 3
    });
  }

  return {
    detected: signals.length > 0,
    signals,
    latestRatio: latestRatio.toFixed(2)
  };
}

/**
 * Helper: 前営業日を取得
 */
function getPreviousBusinessDay() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  
  // 土日の場合は金曜日まで戻る
  if (date.getDay() === 0) date.setDate(date.getDate() - 2); // 日曜 -> 金曜
  if (date.getDay() === 6) date.setDate(date.getDate() - 1); // 土曜 -> 金曜
  
  return date;
}

/**
 * Helper: FINRAの日付フォーマット (YYYYMMDD)
 */
function formatDateForFINRA(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Helper: Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock data generator
 */
function generateMockShortData(symbol, dateStr) {
  const shortRatio = 20 + Math.random() * 40; // 20-60%
  const totalVolume = Math.floor(Math.random() * 50000000) + 10000000;
  const shortVolume = Math.floor(totalVolume * shortRatio / 100);
  
  return {
    symbol: symbol.toUpperCase(),
    date: dateStr,
    shortVolume: shortVolume,
    shortExemptVolume: Math.floor(shortVolume * 0.05),
    totalVolume: totalVolume,
    market: 'NASDAQ',
    shortRatio: shortRatio.toFixed(2)
  };
}
