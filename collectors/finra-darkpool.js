/**
 * FINRA Dark Pool (ADF) Data Collector
 * ダークプール取引量データ取得モジュール
 */

import axios from 'axios';

/**
 * OTC/ダークプール取引量データを取得
 * FINRA ADF (Alternative Display Facility)
 */
export async function getDarkPoolData(symbol) {
  try {
    console.log(`[FINRA-ADF] Fetching dark pool data for ${symbol}`);
    
    // Note: FINRA API requires authentication for production use
    // This is a simplified version using public data
    
    // For now, return mock data until API key is configured
    return generateMockDarkPoolData(symbol);

  } catch (error) {
    console.error(`[FINRA-ADF] Failed to fetch dark pool data:`, error.message);
    return generateMockDarkPoolData(symbol);
  }
}

/**
 * 週次ダークプール統計を取得
 */
export async function getWeeklyDarkPoolStats(symbol) {
  try {
    console.log(`[FINRA-ADF] Fetching weekly dark pool stats for ${symbol}`);
    
    const weeklyData = [];
    
    // 過去4週間のデータを生成（実際はAPIから取得）
    for (let i = 0; i < 4; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 7));
      
      weeklyData.push(generateMockDarkPoolData(symbol, date));
    }
    
    return {
      symbol: symbol.toUpperCase(),
      period: 'Last 4 weeks',
      data: weeklyData,
      analysis: analyzeDarkPoolTrend(weeklyData)
    };

  } catch (error) {
    console.error(`[FINRA-ADF] Failed to fetch weekly stats:`, error.message);
    return {
      symbol: symbol.toUpperCase(),
      error: error.message,
      data: []
    };
  }
}

/**
 * ダークプールトレンドを分析
 */
function analyzeDarkPoolTrend(data) {
  if (!data || data.length < 2) {
    return {
      trend: 'insufficient_data',
      avgPercentage: 0
    };
  }

  const avgPercentage = data.reduce((sum, d) => 
    sum + parseFloat(d.darkPoolPercentage), 0
  ) / data.length;

  const latest = parseFloat(data[0].darkPoolPercentage);
  const oldest = parseFloat(data[data.length - 1].darkPoolPercentage);
  const change = latest - oldest;

  let trend = 'stable';
  if (change > 10) trend = 'increasing';
  else if (change < -10) trend = 'decreasing';

  return {
    trend,
    avgPercentage: avgPercentage.toFixed(2),
    latestPercentage: latest.toFixed(2),
    change: change.toFixed(2),
    alert: latest > 50
  };
}

/**
 * ダークプール活動の異常検知
 */
export function detectDarkPoolAnomalies(darkPoolData) {
  if (!darkPoolData) {
    return { detected: false, signals: [] };
  }

  const signals = [];
  const percentage = parseFloat(darkPoolData.darkPoolPercentage);

  // 異常に高いダークプール比率 (>50%)
  if (percentage > 50) {
    signals.push({
      type: 'high_dark_pool_activity',
      severity: 'high',
      description: `ダークプール取引が全体の${percentage.toFixed(1)}%を占める`,
      value: percentage,
      threshold: 50
    });
  }

  // 通常より大幅に高い (>45%)
  else if (percentage > 45) {
    signals.push({
      type: 'elevated_dark_pool_activity',
      severity: 'medium',
      description: `ダークプール取引比率が${percentage.toFixed(1)}%と高水準`,
      value: percentage,
      threshold: 45
    });
  }

  return {
    detected: signals.length > 0,
    signals,
    percentage: percentage.toFixed(2)
  };
}

/**
 * ダークプールとLit市場の比較分析
 */
export function compareDarkPoolVsLit(darkPoolData) {
  const darkPoolVolume = darkPoolData.darkPoolVolume;
  const totalVolume = darkPoolData.totalVolume;
  const litVolume = totalVolume - darkPoolVolume;
  
  const darkPoolPercentage = (darkPoolVolume / totalVolume) * 100;
  const litPercentage = (litVolume / totalVolume) * 100;

  return {
    darkPool: {
      volume: darkPoolVolume,
      percentage: darkPoolPercentage.toFixed(2)
    },
    lit: {
      volume: litVolume,
      percentage: litPercentage.toFixed(2)
    },
    ratio: (darkPoolVolume / litVolume).toFixed(2),
    transparency: litPercentage > 60 ? 'high' : litPercentage > 40 ? 'medium' : 'low'
  };
}

/**
 * Mock data generator
 */
function generateMockDarkPoolData(symbol, date = new Date()) {
  const totalVolume = Math.floor(Math.random() * 50000000) + 20000000;
  
  // 通常のダークプール比率は30-45%
  const basePercentage = 30 + Math.random() * 15;
  
  // 時々異常値を生成
  const isAnomalous = Math.random() > 0.8;
  const darkPoolPercentage = isAnomalous 
    ? basePercentage + 20 + Math.random() * 10  // 50-65%
    : basePercentage;
  
  const darkPoolVolume = Math.floor(totalVolume * darkPoolPercentage / 100);

  return {
    symbol: symbol.toUpperCase(),
    date: date.toISOString().split('T')[0],
    totalVolume: totalVolume,
    darkPoolVolume: darkPoolVolume,
    litVolume: totalVolume - darkPoolVolume,
    darkPoolPercentage: darkPoolPercentage.toFixed(2),
    litPercentage: (100 - darkPoolPercentage).toFixed(2),
    dataSource: 'FINRA ADF (Mock)',
    isAnomalous
  };
}

/**
 * 機関投資家によるダークプール使用パターン分析
 */
export function analyzeInstitutionalDarkPoolUsage(darkPoolData, volumeData) {
  // 大口取引がダークプールに集中しているかを分析
  const darkPoolPercentage = parseFloat(darkPoolData.darkPoolPercentage);
  const avgTradeSize = darkPoolData.darkPoolVolume / (darkPoolData.totalVolume / volumeData.avgVolume);
  
  let pattern = 'normal';
  let confidence = 0;
  
  if (darkPoolPercentage > 50 && avgTradeSize > 1.5) {
    pattern = 'institutional_accumulation';
    confidence = 0.75;
  } else if (darkPoolPercentage > 45 && avgTradeSize > 1.2) {
    pattern = 'institutional_activity';
    confidence = 0.6;
  } else if (darkPoolPercentage < 25) {
    pattern = 'retail_dominated';
    confidence = 0.7;
  }

  return {
    pattern,
    confidence: confidence.toFixed(2),
    darkPoolPercentage: darkPoolPercentage.toFixed(2),
    avgTradeSize: avgTradeSize.toFixed(2),
    description: getPatternDescription(pattern)
  };
}

function getPatternDescription(pattern) {
  const descriptions = {
    'institutional_accumulation': '機関投資家がダークプールで大量買い付けの可能性',
    'institutional_activity': '機関投資家のダークプール活動が活発',
    'retail_dominated': '個人投資家主導の取引',
    'normal': '通常の取引パターン'
  };
  
  return descriptions[pattern] || 'Unknown pattern';
}
