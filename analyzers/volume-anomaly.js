/**
 * Volume Anomaly Detector
 * 出来高異常検知モジュール
 */

const VOLUME_SPIKE_THRESHOLD = 3.0;  // 平均の3倍以上
const CLOSING_WINDOW_MINUTES = 15;   // 終値前15分

/**
 * 出来高異常を検知
 * @param {Object} params - パラメータ
 * @param {Array} params.historicalData - 過去20日分の日次データ [{date, volume, close}]
 * @param {Object} params.currentData - 当日データ {volume, close}
 * @param {Array} params.intradayData - 分足データ (オプション)
 * @returns {Object} 異常検知結果
 */
export function detectVolumeAnomaly({ historicalData, currentData, intradayData = null }) {
  // 20日平均出来高を計算
  const avgVolume = calculateAverageVolume(historicalData);
  
  // 当日出来高 vs 平均の比率
  const volumeRatio = currentData.volume / avgVolume;
  
  // 出来高スパイク判定
  const hasVolumeSpike = volumeRatio > VOLUME_SPIKE_THRESHOLD;
  
  // 終値前の出来高集中度を計算 (分足データがある場合)
  let closingConcentration = null;
  let closingVolumeRatio = 0;
  
  if (intradayData && intradayData.length > 0) {
    closingConcentration = analyzeClosingVolume(intradayData);
    closingVolumeRatio = closingConcentration.ratio;
  }
  
  // 異常度スコアを計算 (0-1)
  const anomalyScore = calculateAnomalyScore({
    volumeRatio,
    closingVolumeRatio,
    hasVolumeSpike
  });
  
  // シグナルを生成
  const signals = [];
  
  if (hasVolumeSpike) {
    signals.push({
      type: 'volume_spike',
      severity: volumeRatio > 5.0 ? 'high' : 'medium',
      description: `出来高が平均の${volumeRatio.toFixed(1)}倍に急増`,
      value: volumeRatio,
      threshold: VOLUME_SPIKE_THRESHOLD
    });
  }
  
  if (closingVolumeRatio > 0.3) {
    signals.push({
      type: 'closing_volume_concentration',
      severity: closingVolumeRatio > 0.5 ? 'high' : 'medium',
      description: `終値前${CLOSING_WINDOW_MINUTES}分に全体の${(closingVolumeRatio * 100).toFixed(0)}%の出来高集中`,
      value: closingVolumeRatio,
      threshold: 0.3
    });
  }
  
  return {
    anomalyDetected: signals.length > 0,
    anomalyScore,
    signals,
    metrics: {
      avgVolume,
      currentVolume: currentData.volume,
      volumeRatio,
      closingVolumeRatio
    }
  };
}

/**
 * 平均出来高を計算
 */
function calculateAverageVolume(historicalData) {
  if (!historicalData || historicalData.length === 0) {
    throw new Error('Historical data is required');
  }
  
  const volumes = historicalData.map(d => d.volume);
  const sum = volumes.reduce((acc, vol) => acc + vol, 0);
  return sum / volumes.length;
}

/**
 * 終値前の出来高集中を分析
 */
function analyzeClosingVolume(intradayData) {
  if (!intradayData || intradayData.length === 0) {
    return { ratio: 0, closingVolume: 0, totalVolume: 0 };
  }
  
  // 最後のN分間のデータを抽出
  const lastMinutes = intradayData.slice(-CLOSING_WINDOW_MINUTES);
  
  // 終値前の出来高合計
  const closingVolume = lastMinutes.reduce((sum, d) => sum + (d.volume || 0), 0);
  
  // 全体の出来高合計
  const totalVolume = intradayData.reduce((sum, d) => sum + (d.volume || 0), 0);
  
  // 比率を計算
  const ratio = totalVolume > 0 ? closingVolume / totalVolume : 0;
  
  return {
    ratio,
    closingVolume,
    totalVolume,
    windowMinutes: CLOSING_WINDOW_MINUTES
  };
}

/**
 * 異常度スコアを計算 (0-1)
 */
function calculateAnomalyScore({ volumeRatio, closingVolumeRatio, hasVolumeSpike }) {
  let score = 0;
  
  // 出来高比率による加算 (最大0.5)
  if (volumeRatio >= VOLUME_SPIKE_THRESHOLD) {
    const volumeScore = Math.min((volumeRatio - VOLUME_SPIKE_THRESHOLD) / 7.0, 0.5);
    score += volumeScore;
  }
  
  // 終値前集中度による加算 (最大0.5)
  if (closingVolumeRatio > 0.3) {
    const closingScore = Math.min((closingVolumeRatio - 0.3) / 0.7, 0.5);
    score += closingScore;
  }
  
  return Math.min(score, 1.0);
}

/**
 * 出来高パターン分析
 */
export function analyzeVolumePattern(historicalData) {
  if (!historicalData || historicalData.length < 5) {
    return { pattern: 'insufficient_data', confidence: 0 };
  }
  
  const recentVolumes = historicalData.slice(-5).map(d => d.volume);
  const avgRecent = recentVolumes.reduce((a, b) => a + b) / recentVolumes.length;
  
  const olderVolumes = historicalData.slice(0, -5).map(d => d.volume);
  const avgOlder = olderVolumes.reduce((a, b) => a + b) / olderVolumes.length;
  
  const trend = (avgRecent - avgOlder) / avgOlder;
  
  let pattern = 'stable';
  let confidence = 0;
  
  if (trend > 0.5) {
    pattern = 'increasing';
    confidence = Math.min(trend, 1.0);
  } else if (trend < -0.5) {
    pattern = 'decreasing';
    confidence = Math.min(Math.abs(trend), 1.0);
  } else {
    pattern = 'stable';
    confidence = 1.0 - Math.abs(trend);
  }
  
  return {
    pattern,
    confidence: confidence.toFixed(2),
    trend: trend.toFixed(3),
    avgRecent,
    avgOlder
  };
}
