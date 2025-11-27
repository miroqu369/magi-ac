/**
 * Institutional Flow Analyzer
 * 機関投資家資金フロー分析モジュール
 */

/**
 * 13F変動分析
 */
export function analyze13FChanges(currentHoldings, previousHoldings = null) {
  if (!currentHoldings || currentHoldings.length === 0) {
    return {
      newPositions: [],
      increasedPositions: [],
      decreasedPositions: [],
      exitedPositions: [],
      unusualActivity: []
    };
  }

  // 前四半期データがない場合は現在のホールディングスのみ返す
  if (!previousHoldings) {
    return {
      newPositions: currentHoldings.map(h => ({
        institution: h.institution,
        shares: h.shares || 0,
        value: h.value || 0
      })),
      increasedPositions: [],
      decreasedPositions: [],
      exitedPositions: [],
      unusualActivity: []
    };
  }

  const changes = {
    newPositions: [],
    increasedPositions: [],
    decreasedPositions: [],
    exitedPositions: [],
    unusualActivity: []
  };

  // 現在のホールディングスを分析
  currentHoldings.forEach(current => {
    const previous = previousHoldings.find(p => 
      p.institution === current.institution
    );

    if (!previous) {
      // 新規ポジション
      changes.newPositions.push({
        institution: current.institution,
        shares: current.shares,
        value: current.value
      });
    } else {
      // ポジション変動を計算
      const shareChange = current.shares - previous.shares;
      const percentChange = (shareChange / previous.shares) * 100;

      if (shareChange > 0) {
        changes.increasedPositions.push({
          institution: current.institution,
          shareChange,
          percentChange: percentChange.toFixed(2),
          currentShares: current.shares,
          previousShares: previous.shares
        });

        // 50%以上の増加は異常
        if (percentChange > 50) {
          changes.unusualActivity.push({
            institution: current.institution,
            type: 'LARGE_INCREASE',
            percentChange: percentChange.toFixed(2),
            severity: percentChange > 100 ? 'high' : 'medium'
          });
        }
      } else if (shareChange < 0) {
        changes.decreasedPositions.push({
          institution: current.institution,
          shareChange,
          percentChange: percentChange.toFixed(2),
          currentShares: current.shares,
          previousShares: previous.shares
        });

        // 50%以上の減少は異常
        if (Math.abs(percentChange) > 50) {
          changes.unusualActivity.push({
            institution: current.institution,
            type: 'LARGE_DECREASE',
            percentChange: percentChange.toFixed(2),
            severity: Math.abs(percentChange) > 80 ? 'high' : 'medium'
          });
        }
      }
    }
  });

  // 完全撤退したポジションを検出
  if (previousHoldings) {
    previousHoldings.forEach(previous => {
      const current = currentHoldings.find(c => 
        c.institution === previous.institution
      );

      if (!current) {
        changes.exitedPositions.push({
          institution: previous.institution,
          shares: previous.shares,
          value: previous.value
        });

        changes.unusualActivity.push({
          institution: previous.institution,
          type: 'COMPLETE_EXIT',
          severity: 'high'
        });
      }
    });
  }

  return changes;
}

/**
 * ダークプール比率分析
 */
export function analyzeDarkPoolActivity(darkPoolData, historicalAverage = 35) {
  if (!darkPoolData) {
    return {
      percentage: 0,
      trend: 'unknown',
      alert: false
    };
  }

  const percentage = parseFloat(darkPoolData.darkPoolPercentage);
  const deviation = percentage - historicalAverage;

  let trend = 'normal';
  let alert = false;

  if (percentage > 50) {
    trend = 'extremely_high';
    alert = true;
  } else if (percentage > 45) {
    trend = 'elevated';
    alert = true;
  } else if (percentage < 25) {
    trend = 'low';
  }

  return {
    percentage: percentage.toFixed(2),
    historicalAverage: historicalAverage.toFixed(2),
    deviation: deviation.toFixed(2),
    trend,
    alert,
    interpretation: interpretDarkPoolActivity(trend, percentage)
  };
}

/**
 * 機関投資家フローの総合分析
 */
export function analyzeInstitutionalFlow(params) {
  const {
    holdings13F,
    darkPoolData,
    shortData,
    volumeData
  } = params;

  // フロー方向を判定
  let flowDirection = 'neutral';
  let flowStrength = 0;
  const signals = [];

  // 13F分析
  if (holdings13F) {
    const increasedCount = holdings13F.increasedPositions?.length || 0;
    const decreasedCount = holdings13F.decreasedPositions?.length || 0;
    
    if (increasedCount > decreasedCount * 2) {
      flowDirection = 'bullish';
      flowStrength += 0.3;
      signals.push('機関投資家のポジション増加が優勢');
    } else if (decreasedCount > increasedCount * 2) {
      flowDirection = 'bearish';
      flowStrength += 0.3;
      signals.push('機関投資家のポジション減少が優勢');
    }
  }

  // ダークプール分析
  if (darkPoolData) {
    const dpPercentage = parseFloat(darkPoolData.darkPoolPercentage);
    if (dpPercentage > 45) {
      flowStrength += 0.3;
      signals.push(`ダークプール活動が活発 (${dpPercentage.toFixed(1)}%)`);
    }
  }

  // 空売り分析
  if (shortData) {
    const shortRatio = parseFloat(shortData.shortRatio || shortData.latestRatio);
    if (shortRatio > 40) {
      if (flowDirection === 'bullish') {
        flowDirection = 'mixed';
      } else {
        flowDirection = 'bearish';
      }
      flowStrength += 0.2;
      signals.push(`高い空売り比率 (${shortRatio.toFixed(1)}%)`);
    }
  }

  // 出来高分析
  if (volumeData && volumeData.volumeRatio > 2) {
    flowStrength += 0.2;
    signals.push(`出来高急増 (平均の${volumeData.volumeRatio.toFixed(1)}倍)`);
  }

  return {
    flowDirection,
    flowStrength: Math.min(flowStrength, 1.0).toFixed(2),
    signals,
    confidence: calculateFlowConfidence(flowDirection, flowStrength),
    interpretation: interpretInstitutionalFlow(flowDirection, flowStrength)
  };
}

/**
 * 資金フローの信頼度を計算
 */
function calculateFlowConfidence(direction, strength) {
  if (direction === 'neutral') return 0.3;
  if (direction === 'mixed') return 0.5;
  
  return Math.min(0.5 + parseFloat(strength) * 0.5, 0.95);
}

/**
 * ダークプール活動の解釈
 */
function interpretDarkPoolActivity(trend, percentage) {
  const interpretations = {
    'extremely_high': `ダークプール比率${percentage.toFixed(1)}%は異常に高く、大口投資家の活発な活動を示唆`,
    'elevated': `ダークプール比率${percentage.toFixed(1)}%は高水準で、機関投資家の活動が活発`,
    'normal': `ダークプール比率${percentage.toFixed(1)}%は正常範囲`,
    'low': `ダークプール比率${percentage.toFixed(1)}%は低く、透明性の高い取引`
  };
  
  return interpretations[trend] || 'Unknown';
}

/**
 * 機関投資家フローの解釈
 */
function interpretInstitutionalFlow(direction, strength) {
  const strengthLevel = parseFloat(strength) > 0.7 ? '強い' : parseFloat(strength) > 0.4 ? '中程度の' : '弱い';
  
  const interpretations = {
    'bullish': `${strengthLevel}買い圧力 - 機関投資家が積極的にポジション構築`,
    'bearish': `${strengthLevel}売り圧力 - 機関投資家がポジション削減`,
    'mixed': `${strengthLevel}混合シグナル - 機関投資家の見解が分かれている`,
    'neutral': '明確なトレンドなし - 様子見姿勢'
  };
  
  return interpretations[direction] || 'Unknown';
}

/**
 * 機関投資家の行動パターン分類
 */
export function classifyInstitutionalBehavior(flowData) {
  const { flowDirection, flowStrength } = flowData;
  const strength = parseFloat(flowStrength);
  
  if (flowDirection === 'bullish' && strength > 0.7) {
    return {
      pattern: 'AGGRESSIVE_ACCUMULATION',
      description: '積極的な買い集め',
      risk: 'low',
      recommendation: 'FOLLOW'
    };
  }
  
  if (flowDirection === 'bearish' && strength > 0.7) {
    return {
      pattern: 'AGGRESSIVE_DISTRIBUTION',
      description: '積極的な売り崩し',
      risk: 'high',
      recommendation: 'AVOID'
    };
  }
  
  if (flowDirection === 'mixed') {
    return {
      pattern: 'DIVERGENCE',
      description: '機関投資家の意見対立',
      risk: 'medium',
      recommendation: 'CAUTION'
    };
  }
  
  return {
    pattern: 'NEUTRAL',
    description: '明確なパターンなし',
    risk: 'medium',
    recommendation: 'WAIT'
  };
}
