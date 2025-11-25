// collectors/historical-data.js
// Phase 6: 過去50日分のOHLCデータ取得（スウィングトレード用）

import yahooFinance from 'yahoo-finance2';

/**
 * 過去の株価履歴を取得（OHLC: Open, High, Low, Close）
 * @param {string} symbol - ティッカーシンボル（例: AAPL）
 * @param {number} period - 取得期間（日数、デフォルト50日）
 * @returns {Promise<Object>} 履歴データ
 */
export async function getHistoricalData(symbol, period = 50) {
  try {
    console.log(`[HistoricalData] 取得開始: ${symbol} (過去${period}日)`);
    
    // 期間設定
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);
    
    // Yahoo Finance APIで履歴データ取得
    const queryOptions = {
      period1: startDate,
      period2: endDate,
      interval: '1d' // 日次データ
    };
    
    const history = await yahooFinance.historical(symbol, queryOptions);
    
    if (!history || history.length === 0) {
      throw new Error(`履歴データが取得できませんでした: ${symbol}`);
    }
    
    console.log(`[HistoricalData] 取得成功: ${history.length}日分のデータ`);
    
    // データ整形
    const formattedData = history.map(day => ({
      date: day.date.toISOString().split('T')[0],
      open: day.open,
      high: day.high,
      low: day.low,
      close: day.close,
      volume: day.volume,
      adjClose: day.adjClose || day.close
    }));
    
    // 最新が先頭になるように並び替え（計算で使いやすいように）
    formattedData.reverse();
    
    return {
      success: true,
      symbol: symbol.toUpperCase(),
      period: period,
      data_points: formattedData.length,
      start_date: formattedData[formattedData.length - 1].date,
      end_date: formattedData[0].date,
      history: formattedData
    };
    
  } catch (error) {
    console.error(`[HistoricalData] エラー:`, error.message);
    return {
      success: false,
      symbol: symbol.toUpperCase(),
      error: error.message,
      history: []
    };
  }
}

/**
 * 終値のみの配列を取得（テクニカル指標計算用）
 * @param {string} symbol - ティッカーシンボル
 * @param {number} period - 期間
 * @returns {Promise<number[]>} 終値の配列（最新が先頭）
 */
export async function getClosePrices(symbol, period = 50) {
  const data = await getHistoricalData(symbol, period);
  
  if (!data.success) {
    throw new Error(`価格データ取得失敗: ${data.error}`);
  }
  
  return data.history.map(day => day.close);
}

/**
 * OHLCデータ配列を取得（ATR計算用）
 * @param {string} symbol - ティッカーシンボル
 * @param {number} period - 期間
 * @returns {Promise<Array>} OHLC配列
 */
export async function getOHLCData(symbol, period = 50) {
  const data = await getHistoricalData(symbol, period);
  
  if (!data.success) {
    throw new Error(`OHLCデータ取得失敗: ${data.error}`);
  }
  
  return data.history;
}

export default {
  getHistoricalData,
  getClosePrices,
  getOHLCData
};
