/**
 * Price Manipulation Detector
 * 価格操作パターン検出モジュール
 */

/**
 * 終値操作を検出 (Closing Price Manipulation)
 * 最後の数分で急激な価格変動
 */
export function detectClosingManipulation(intradayData, windowMinutes = 15) {
  if (!intradayData || intradayData.length < windowMinutes) {
    return { detected: false, confidence: 0 };
  }
  
  const lastWindow = intradayData.slice(-windowMinutes);
  const beforeWindow = intradayData.slice(0, -windowMinutes);
  
  // 終値前の価格変動率
  const closingChange = (lastWindow[lastWindow.length - 1].close - lastWindow[0].close) / lastWindow[0].close;
  
  // それ以前の平均変動率
  const avgChangePerMinute = beforeWindow.length > 0 
    ? calculateAverageVolatility(beforeWindow) 
    : 0;
  
  // 異常な変動かどうか判定
  const isAnomalous = Math.abs(closingChange) > avgChangePerMinute * 3;
  const confidence = Math.min(Math.abs(closingChange) / (avgChangePerMinute * 3), 1.0);
  
  return {
    detected: isAnomalous,
    confidence: confidence.toFixed(2),
    closingChange: closingChange.toFixed(4),
    avgVolatility: avgChangePerMinute.toFixed(4),
    description: isAnomalous 
      ? `終値前${windowMinutes}分で${(closingChange * 100).toFixed(2)}%の異常変動` 
      : 'Normal closing activity'
  };
}

/**
 * ペインティング・ザ・テープ検出
 * 小口連続取引で印象操作
 */
export function detectPaintingTheTape(intradayData) {
  if (!intradayData || intradayData.length < 30) {
    return { detected: false, confidence: 0 };
  }
  
  // 連続的な小口取引を検出
  let consecutiveSmallTrades = 0;
  let maxConsecutive = 0;
  
  const avgVolume = intradayData.reduce((sum, d) => sum + d.volume, 0) / intradayData.length;
  const smallTradeThreshold = avgVolume * 0.2; // 平均の20%以下
  
  for (const data of intradayData) {
    if (data.volume < smallTradeThreshold) {
      consecutiveSmallTrades++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveSmallTrades);
    } else {
      consecutiveSmallTrades = 0;
    }
  }
  
  // 10回以上連続する小口取引は疑わしい
  const detected = maxConsecutive >= 10;
  const confidence = Math.min(maxConsecutive / 20, 1.0);
  
  return {
    detected,
    confidence: confidence.toFixed(2),
    maxConsecutiveSmallTrades: maxConsecutive,
    threshold: 10,
    description: detected 
      ? `${maxConsecutive}回連続の小口取引を検出` 
      : 'Normal trading pattern'
  };
}

/**
 * ウォッシュトレード検出
 * 同一価格での大量往復取引
 */
export function detectWashTrading(intradayData) {
  if (!intradayData || intradayData.length < 10) {
    return { detected: false, confidence: 0 };
  }
  
  // 同一価格帯での取引を集計
  const priceGroups = {};
  
  intradayData.forEach(d => {
    const priceKey = d.close.toFixed(2);
    if (!priceGroups[priceKey]) {
      priceGroups[priceKey] = { count: 0, volume: 0 };
    }
    priceGroups[priceKey].count++;
    priceGroups[priceKey].volume += d.volume;
  });
  
  // 最も頻繁な価格を見つける
  let maxCount = 0;
  let suspiciousPrice = null;
  
  for (const [price, data] of Object.entries(priceGroups)) {
    if (data.count > maxCount) {
      maxCount = data.count;
      suspiciousPrice = price;
    }
  }
  
  // 全体の30%以上が同一価格帯は疑わしい
  const totalCount = intradayData.length;
  const concentration = maxCount / totalCount;
  const detected = concentration > 0.3;
  
  return {
    detected,
    confidence: Math.min(concentration, 1.0).toFixed(2),
    suspiciousPrice,
    concentrationRate: (concentration * 100).toFixed(1) + '%',
    occurrences: maxCount,
    description: detected 
      ? `価格${suspiciousPrice}で${maxCount}回(${(concentration * 100).toFixed(1)}%)の取引集中` 
      : 'Normal price distribution'
  };
}

/**
 * 総合的な操作パターン分析
 */
export function analyzeManipulationPatterns(intradayData) {
  const patterns = {
    closingManipulation: detectClosingManipulation(intradayData),
    paintingTheTape: detectPaintingTheTape(intradayData),
    washTrading: detectWashTrading(intradayData)
  };
  
  // 総合スコア計算
  const detectedPatterns = Object.values(patterns).filter(p => p.detected);
  const avgConfidence = detectedPatterns.length > 0
    ? detectedPatterns.reduce((sum, p) => sum + parseFloat(p.confidence), 0) / detectedPatterns.length
    : 0;
  
  return {
    manipulationDetected: detectedPatterns.length > 0,
    manipulationScore: avgConfidence.toFixed(2),
    patternsDetected: detectedPatterns.length,
    patterns
  };
}

/**
 * 平均ボラティリティを計算
 */
function calculateAverageVolatility(data) {
  if (!data || data.length < 2) return 0;
  
  let totalChange = 0;
  for (let i = 1; i < data.length; i++) {
    const change = Math.abs((data[i].close - data[i - 1].close) / data[i - 1].close);
    totalChange += change;
  }
  
  return totalChange / (data.length - 1);
}
