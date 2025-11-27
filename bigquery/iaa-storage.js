/**
 * BigQuery IAA (Institutional Activity Analyzer) Module
 * 操作シグナル・AI分析結果の保存・取得
 */

import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const DATASET_ID = 'magi_ac';
const MANIPULATION_SIGNALS_TABLE = 'manipulation_signals';
const AI_ANALYSES_TABLE = 'ai_analyses';
const INSTITUTIONAL_POSITIONS_TABLE = 'institutional_positions';

/**
 * 操作シグナルをBigQueryに保存
 */
export async function saveManipulationSignals(analysisData) {
  try {
    const { symbol, timestamp, manipulation_score, signals, volume_analysis, 
            price_manipulation, short_interest, dark_pool, institutional_activity } = analysisData;

    const row = {
      id: `${symbol}_${Date.now()}`,
      symbol: symbol,
      timestamp: timestamp,
      manipulation_score: manipulation_score,
      signal_count: signals.length,
      high_severity_count: signals.filter(s => s.severity === 'high').length,
      
      // 個別シグナル
      signals: JSON.stringify(signals),
      
      // 出来高分析
      volume_anomaly_detected: volume_analysis.anomaly_detected,
      volume_anomaly_score: volume_analysis.anomaly_score,
      volume_ratio: volume_analysis.metrics?.volumeRatio || 0,
      
      // 価格操作
      price_manipulation_detected: price_manipulation.detected,
      price_manipulation_score: parseFloat(price_manipulation.score) || 0,
      
      // 空売り
      short_interest_ratio: parseFloat(short_interest.latest_ratio) || 0,
      short_interest_alert: short_interest.alert,
      
      // ダークプール
      dark_pool_percentage: parseFloat(dark_pool.percentage) || 0,
      dark_pool_alert: dark_pool.analysis?.alert || false,
      
      // 機関投資家
      institutional_flow_direction: institutional_activity.flow_direction,
      institutional_flow_strength: parseFloat(institutional_activity.flow_strength) || 0,
      
      // メタデータ
      created_at: new BigQuery.timestamp(new Date())
    };

    await bigquery
      .dataset(DATASET_ID)
      .table(MANIPULATION_SIGNALS_TABLE)
      .insert([row]);

    console.log(`[BIGQUERY] Saved manipulation signal for ${symbol}`);
    return row.id;

  } catch (error) {
    console.error('[BIGQUERY] Failed to save manipulation signals:', error.message);
    throw error;
  }
}

/**
 * AI分析結果をBigQueryに保存
 */
export async function saveAIAnalysis(symbol, aiAnalysis) {
  try {
    if (!aiAnalysis || !aiAnalysis.consensus_available) {
      console.log('[BIGQUERY] No AI analysis to save');
      return null;
    }

    const { consensus, individual_analyses, responses_received } = aiAnalysis;

    const row = {
      id: `${symbol}_ai_${Date.now()}`,
      symbol: symbol,
      timestamp: new BigQuery.timestamp(new Date()),
      
      // 合議結果
      consensus_manipulation_likelihood: consensus.manipulation_likelihood,
      consensus_confidence: parseFloat(consensus.confidence_score) || 0,
      consensus_agreement_level: parseFloat(consensus.agreement_level) || 0,
      consensus_recommended_action: consensus.recommended_action,
      consensus_summary: consensus.summary,
      
      // メタデータ
      responses_received: responses_received,
      individual_analyses: JSON.stringify(individual_analyses),
      top_concerns: JSON.stringify(consensus.top_concerns || []),
      top_risk_factors: JSON.stringify(consensus.top_risk_factors || []),
      
      created_at: new BigQuery.timestamp(new Date())
    };

    await bigquery
      .dataset(DATASET_ID)
      .table(AI_ANALYSES_TABLE)
      .insert([row]);

    console.log(`[BIGQUERY] Saved AI analysis for ${symbol}`);
    return row.id;

  } catch (error) {
    console.error('[BIGQUERY] Failed to save AI analysis:', error.message);
    throw error;
  }
}

/**
 * 機関投資家ポジションを保存
 */
export async function saveInstitutionalPositions(symbol, holdings) {
  try {
    if (!holdings || holdings.length === 0) {
      return null;
    }

    const rows = holdings.map(holding => ({
      id: `${holding.institution}_${symbol}_${Date.now()}`,
      symbol: symbol,
      institution: holding.institution,
      filing_date: holding.filingDate,
      report_date: holding.reportDate,
      shares: holding.shares || 0,
      value: holding.value || 0,
      change_from_previous: holding.changeFromPreviousQuarter || '0%',
      accession_number: holding.accessionNumber || '',
      created_at: new BigQuery.timestamp(new Date())
    }));

    await bigquery
      .dataset(DATASET_ID)
      .table(INSTITUTIONAL_POSITIONS_TABLE)
      .insert(rows);

    console.log(`[BIGQUERY] Saved ${rows.length} institutional positions for ${symbol}`);
    return rows.length;

  } catch (error) {
    console.error('[BIGQUERY] Failed to save institutional positions:', error.message);
    throw error;
  }
}

/**
 * 操作シグナル履歴を取得
 */
export async function getManipulationHistory(symbol, days = 30) {
  const query = `
    SELECT 
      id,
      symbol,
      timestamp,
      manipulation_score,
      signal_count,
      high_severity_count,
      volume_anomaly_detected,
      price_manipulation_detected,
      short_interest_alert,
      dark_pool_alert,
      institutional_flow_direction
    FROM \`${DATASET_ID}.${MANIPULATION_SIGNALS_TABLE}\`
    WHERE symbol = @symbol
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    ORDER BY timestamp DESC
  `;

  const options = {
    query,
    params: { symbol, days }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows;
  } catch (error) {
    console.error('[BIGQUERY] Query manipulation history failed:', error.message);
    throw error;
  }
}

/**
 * AI分析履歴を取得
 */
export async function getAIAnalysisHistory(symbol, days = 30) {
  const query = `
    SELECT 
      id,
      symbol,
      timestamp,
      consensus_manipulation_likelihood,
      consensus_confidence,
      consensus_agreement_level,
      consensus_recommended_action,
      responses_received
    FROM \`${DATASET_ID}.${AI_ANALYSES_TABLE}\`
    WHERE symbol = @symbol
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    ORDER BY timestamp DESC
  `;

  const options = {
    query,
    params: { symbol, days }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows;
  } catch (error) {
    console.error('[BIGQUERY] Query AI history failed:', error.message);
    throw error;
  }
}

/**
 * 高リスクアラート一覧を取得
 */
export async function getHighRiskAlerts(threshold = 0.7, limit = 50) {
  const query = `
    SELECT 
      symbol,
      timestamp,
      manipulation_score,
      signal_count,
      high_severity_count,
      institutional_flow_direction
    FROM \`${DATASET_ID}.${MANIPULATION_SIGNALS_TABLE}\`
    WHERE manipulation_score >= @threshold
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    ORDER BY manipulation_score DESC, timestamp DESC
    LIMIT @limit
  `;

  const options = {
    query,
    params: { threshold, limit }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows;
  } catch (error) {
    console.error('[BIGQUERY] Query high risk alerts failed:', error.message);
    throw error;
  }
}

/**
 * 統計サマリーを取得
 */
export async function getStatsSummary(days = 30) {
  const query = `
    SELECT 
      COUNT(DISTINCT symbol) as total_symbols_analyzed,
      COUNT(*) as total_analyses,
      AVG(manipulation_score) as avg_manipulation_score,
      SUM(CASE WHEN manipulation_score >= 0.7 THEN 1 ELSE 0 END) as high_risk_count,
      SUM(CASE WHEN manipulation_score >= 0.4 AND manipulation_score < 0.7 THEN 1 ELSE 0 END) as medium_risk_count,
      SUM(CASE WHEN manipulation_score < 0.4 THEN 1 ELSE 0 END) as low_risk_count
    FROM \`${DATASET_ID}.${MANIPULATION_SIGNALS_TABLE}\`
    WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
  `;

  const options = {
    query,
    params: { days }
  };

  try {
    const [rows] = await bigquery.query(options);
    return rows[0] || null;
  } catch (error) {
    console.error('[BIGQUERY] Query stats summary failed:', error.message);
    throw error;
  }
}

/**
 * BigQueryテーブルを初期化
 */
export async function initializeIAATables() {
  const dataset = bigquery.dataset(DATASET_ID);

  // manipulation_signals テーブル
  const manipulationSignalsSchema = [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
    { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'manipulation_score', type: 'FLOAT64', mode: 'REQUIRED' },
    { name: 'signal_count', type: 'INT64', mode: 'REQUIRED' },
    { name: 'high_severity_count', type: 'INT64', mode: 'REQUIRED' },
    { name: 'signals', type: 'STRING', mode: 'NULLABLE' },
    { name: 'volume_anomaly_detected', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'volume_anomaly_score', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'volume_ratio', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'price_manipulation_detected', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'price_manipulation_score', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'short_interest_ratio', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'short_interest_alert', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'dark_pool_percentage', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'dark_pool_alert', type: 'BOOLEAN', mode: 'NULLABLE' },
    { name: 'institutional_flow_direction', type: 'STRING', mode: 'NULLABLE' },
    { name: 'institutional_flow_strength', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  ];

  // ai_analyses テーブル
  const aiAnalysesSchema = [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
    { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'consensus_manipulation_likelihood', type: 'STRING', mode: 'NULLABLE' },
    { name: 'consensus_confidence', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'consensus_agreement_level', type: 'FLOAT64', mode: 'NULLABLE' },
    { name: 'consensus_recommended_action', type: 'STRING', mode: 'NULLABLE' },
    { name: 'consensus_summary', type: 'STRING', mode: 'NULLABLE' },
    { name: 'responses_received', type: 'INT64', mode: 'NULLABLE' },
    { name: 'individual_analyses', type: 'STRING', mode: 'NULLABLE' },
    { name: 'top_concerns', type: 'STRING', mode: 'NULLABLE' },
    { name: 'top_risk_factors', type: 'STRING', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  ];

  // institutional_positions テーブル
  const institutionalPositionsSchema = [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
    { name: 'institution', type: 'STRING', mode: 'REQUIRED' },
    { name: 'filing_date', type: 'STRING', mode: 'NULLABLE' },
    { name: 'report_date', type: 'STRING', mode: 'NULLABLE' },
    { name: 'shares', type: 'INT64', mode: 'NULLABLE' },
    { name: 'value', type: 'INT64', mode: 'NULLABLE' },
    { name: 'change_from_previous', type: 'STRING', mode: 'NULLABLE' },
    { name: 'accession_number', type: 'STRING', mode: 'NULLABLE' },
    { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
  ];

  try {
    // テーブル作成
    await dataset.table(MANIPULATION_SIGNALS_TABLE).create({ schema: manipulationSignalsSchema });
    console.log(`[BIGQUERY] Created table: ${MANIPULATION_SIGNALS_TABLE}`);

    await dataset.table(AI_ANALYSES_TABLE).create({ schema: aiAnalysesSchema });
    console.log(`[BIGQUERY] Created table: ${AI_ANALYSES_TABLE}`);

    await dataset.table(INSTITUTIONAL_POSITIONS_TABLE).create({ schema: institutionalPositionsSchema });
    console.log(`[BIGQUERY] Created table: ${INSTITUTIONAL_POSITIONS_TABLE}`);

    return true;
  } catch (error) {
    if (error.code === 409) {
      console.log('[BIGQUERY] Tables already exist');
      return true;
    }
    console.error('[BIGQUERY] Failed to initialize tables:', error.message);
    throw error;
  }
}
