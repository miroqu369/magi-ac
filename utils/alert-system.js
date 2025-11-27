/**
 * Alert System Module
 * リアルタイム監視・アラート通知機能
 */

import { getHighRiskAlerts, getManipulationHistory } from '../bigquery/iaa-storage.js';

// アラート設定
const ALERT_CONFIG = {
  HIGH_RISK_THRESHOLD: 0.7,
  MEDIUM_RISK_THRESHOLD: 0.4,
  CHECK_INTERVAL_MS: 60000, // 1分
  HISTORY_DAYS: 7,
  MAX_ALERTS_PER_CHECK: 50
};

// アラート履歴 (メモリ内キャッシュ)
const alertHistory = new Map();

/**
 * アラート条件をチェック
 */
export function checkAlertConditions(analysisData) {
  const { symbol, manipulation_score, signals, institutional_activity } = analysisData;
  
  const alerts = [];
  
  // 高リスクアラート
  if (manipulation_score >= ALERT_CONFIG.HIGH_RISK_THRESHOLD) {
    alerts.push({
      level: 'HIGH',
      type: 'MANIPULATION_RISK',
      symbol: symbol,
      score: manipulation_score,
      message: `${symbol}: 操作リスク高 (スコア: ${manipulation_score})`,
      severity: 'critical',
      timestamp: new Date().toISOString()
    });
  }
  
  // 中リスクアラート
  else if (manipulation_score >= ALERT_CONFIG.MEDIUM_RISK_THRESHOLD) {
    alerts.push({
      level: 'MEDIUM',
      type: 'MANIPULATION_RISK',
      symbol: symbol,
      score: manipulation_score,
      message: `${symbol}: 操作リスク中 (スコア: ${manipulation_score})`,
      severity: 'warning',
      timestamp: new Date().toISOString()
    });
  }
  
  // 複数高重大度シグナル
  const highSeveritySignals = signals.filter(s => s.severity === 'high');
  if (highSeveritySignals.length >= 3) {
    alerts.push({
      level: 'HIGH',
      type: 'MULTIPLE_HIGH_SIGNALS',
      symbol: symbol,
      count: highSeveritySignals.length,
      message: `${symbol}: ${highSeveritySignals.length}件の高重大度シグナル検出`,
      severity: 'critical',
      signals: highSeveritySignals.map(s => s.type),
      timestamp: new Date().toISOString()
    });
  }
  
  // 機関投資家の異常な動き
  if (institutional_activity.flow_direction === 'bearish' && 
      parseFloat(institutional_activity.flow_strength) > 0.7) {
    alerts.push({
      level: 'MEDIUM',
      type: 'INSTITUTIONAL_SELL_OFF',
      symbol: symbol,
      flow_direction: institutional_activity.flow_direction,
      flow_strength: institutional_activity.flow_strength,
      message: `${symbol}: 機関投資家の強い売り圧力`,
      severity: 'warning',
      timestamp: new Date().toISOString()
    });
  }
  
  return alerts;
}

/**
 * アラートを記録
 */
export function recordAlert(alert) {
  const key = `${alert.symbol}_${alert.type}_${alert.level}`;
  const now = Date.now();
  
  // 重複チェック (5分以内の同一アラートは無視)
  if (alertHistory.has(key)) {
    const lastAlert = alertHistory.get(key);
    if (now - lastAlert.timestamp < 300000) { // 5分
      return false; // スキップ
    }
  }
  
  alertHistory.set(key, {
    ...alert,
    timestamp: now
  });
  
  // 古いアラートを削除 (1時間以上前)
  for (const [k, v] of alertHistory.entries()) {
    if (now - v.timestamp > 3600000) {
      alertHistory.delete(k);
    }
  }
  
  return true;
}

/**
 * アクティブなアラートを取得
 */
export function getActiveAlerts() {
  const now = Date.now();
  const activeAlerts = [];
  
  for (const [key, alert] of alertHistory.entries()) {
    // 過去1時間以内のアラート
    if (now - alert.timestamp < 3600000) {
      activeAlerts.push({
        ...alert,
        age_minutes: Math.floor((now - alert.timestamp) / 60000)
      });
    }
  }
  
  return activeAlerts.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * アラートサマリーを生成
 */
export function getAlertSummary() {
  const alerts = getActiveAlerts();
  
  const summary = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    by_type: {},
    recent_alerts: alerts.slice(0, 10)
  };
  
  // タイプ別集計
  alerts.forEach(alert => {
    summary.by_type[alert.type] = (summary.by_type[alert.type] || 0) + 1;
  });
  
  return summary;
}

/**
 * トレンド分析 (過去データから異常を検出)
 */
export async function analyzeTrend(symbol) {
  try {
    const history = await getManipulationHistory(symbol, 30);
    
    if (history.length < 3) {
      return {
        trend: 'insufficient_data',
        alert: false
      };
    }
    
    // 最近3件の平均スコア
    const recentScores = history.slice(0, 3).map(h => h.manipulation_score);
    const recentAvg = recentScores.reduce((a, b) => a + b) / recentScores.length;
    
    // それ以前の平均スコア
    const olderScores = history.slice(3).map(h => h.manipulation_score);
    const olderAvg = olderScores.length > 0 
      ? olderScores.reduce((a, b) => a + b) / olderScores.length 
      : recentAvg;
    
    // トレンド判定
    const change = recentAvg - olderAvg;
    let trend = 'stable';
    let alert = false;
    
    if (change > 0.2) {
      trend = 'worsening';
      alert = true;
    } else if (change < -0.2) {
      trend = 'improving';
    }
    
    return {
      trend,
      alert,
      recent_avg: recentAvg.toFixed(2),
      older_avg: olderAvg.toFixed(2),
      change: change.toFixed(2),
      data_points: history.length
    };
    
  } catch (error) {
    console.error('[ALERT] Trend analysis failed:', error.message);
    return {
      trend: 'error',
      alert: false,
      error: error.message
    };
  }
}

/**
 * 監視対象リストの管理
 */
const watchlist = new Set();

export function addToWatchlist(symbol) {
  watchlist.add(symbol.toUpperCase());
  console.log(`[WATCHLIST] Added ${symbol} (total: ${watchlist.size})`);
  return true;
}

export function removeFromWatchlist(symbol) {
  const removed = watchlist.delete(symbol.toUpperCase());
  if (removed) {
    console.log(`[WATCHLIST] Removed ${symbol} (total: ${watchlist.size})`);
  }
  return removed;
}

export function getWatchlist() {
  return Array.from(watchlist);
}

export function isInWatchlist(symbol) {
  return watchlist.has(symbol.toUpperCase());
}

/**
 * アラート通知 (拡張ポイント)
 */
export async function sendAlertNotification(alert) {
  // TODO: メール、Slack、Webhook等の実装
  console.log(`[ALERT] ${alert.level}: ${alert.message}`);
  
  // 将来的な実装例:
  // - sendEmail(alert)
  // - sendSlackMessage(alert)
  // - sendWebhook(alert)
  
  return {
    sent: true,
    method: 'console',
    timestamp: new Date().toISOString()
  };
}

/**
 * バックグラウンド監視 (定期実行)
 */
let monitoringInterval = null;

export function startMonitoring(callback) {
  if (monitoringInterval) {
    console.log('[MONITORING] Already running');
    return false;
  }
  
  console.log('[MONITORING] Started');
  
  monitoringInterval = setInterval(async () => {
    try {
      const alerts = await getHighRiskAlerts(ALERT_CONFIG.HIGH_RISK_THRESHOLD, 10);
      
      if (alerts.length > 0) {
        console.log(`[MONITORING] Found ${alerts.length} high-risk alerts`);
        
        for (const alert of alerts) {
          const alertData = {
            level: 'HIGH',
            type: 'PERIODIC_CHECK',
            symbol: alert.symbol,
            score: alert.manipulation_score,
            message: `定期チェック: ${alert.symbol} 高リスク検出`,
            severity: 'critical',
            timestamp: new Date().toISOString()
          };
          
          if (recordAlert(alertData)) {
            await sendAlertNotification(alertData);
            if (callback) callback(alertData);
          }
        }
      }
    } catch (error) {
      console.error('[MONITORING] Check failed:', error.message);
    }
  }, ALERT_CONFIG.CHECK_INTERVAL_MS);
  
  return true;
}

export function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[MONITORING] Stopped');
    return true;
  }
  return false;
}

/**
 * アラート設定を取得・更新
 */
export function getAlertConfig() {
  return { ...ALERT_CONFIG };
}

export function updateAlertConfig(updates) {
  Object.assign(ALERT_CONFIG, updates);
  console.log('[ALERT] Config updated:', updates);
  return getAlertConfig();
}
