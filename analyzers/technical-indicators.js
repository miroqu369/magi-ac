// analyzers/technical-indicators.js
// Phase 6: テクニカル指標計算エンジン

export function calculateSMA(prices, period) {
  if (prices.length < period) {
    throw new Error(`SMA計算: データ不足。${period}日分必要、${prices.length}日分のみ`);
  }
  const relevantPrices = prices.slice(0, period);
  const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
  return sum / period;
}

export function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    throw new Error(`RSI計算: データ不足`);
  }
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i - 1] - prices[i]);
  }
  const gains = changes.map(change => change > 0 ? change : 0);
  const losses = changes.map(change => change < 0 ? -change : 0);
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < changes.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[prices.length - 1];
  for (let i = prices.length - 2; i >= 0; i--) {
    ema = (prices[i] * k) + (ema * (1 - k));
  }
  return ema;
}

export function calculateMACD(prices) {
  if (prices.length < 26) {
    throw new Error('MACD計算: 最低26日分のデータが必要');
  }
  const ema12 = calculateEMA(prices.slice(0, Math.min(prices.length, 50)), 12);
  const ema26 = calculateEMA(prices.slice(0, Math.min(prices.length, 50)), 26);
  const macdLine = ema12 - ema26;
  const signalLine = macdLine * 0.8;
  const histogram = macdLine - signalLine;
  return { macd_line: macdLine, signal_line: signalLine, histogram: histogram };
}

export function calculateBollingerBands(prices, period = 20, stdDevMultiplier = 2) {
  if (prices.length < period) {
    throw new Error(`Bollinger Bands計算: ${period}日分必要`);
  }
  const middleBand = calculateSMA(prices, period);
  const relevantPrices = prices.slice(0, period);
  const squaredDiffs = relevantPrices.map(price => Math.pow(price - middleBand, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);
  const upperBand = middleBand + (stdDevMultiplier * stdDev);
  const lowerBand = middleBand - (stdDevMultiplier * stdDev);
  const bandwidth = ((upperBand - lowerBand) / middleBand) * 100;
  return { upper: upperBand, middle: middleBand, lower: lowerBand, bandwidth: bandwidth, std_dev: stdDev };
}

export function calculateATR(ohlcData, period = 14) {
  if (ohlcData.length < period + 1) {
    throw new Error(`ATR計算: ${period + 1}日分必要`);
  }
  const trueRanges = [];
  for (let i = 0; i < ohlcData.length - 1; i++) {
    const current = ohlcData[i];
    const previous = ohlcData[i + 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    trueRanges.push(tr);
  }
  const atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  return atr;
}

export function calculateAllIndicators(prices, ohlcData) {
  return {
    sma_20: calculateSMA(prices, 20),
    sma_50: calculateSMA(prices, 50),
    rsi_14: calculateRSI(prices, 14),
    macd: calculateMACD(prices),
    bollinger: calculateBollingerBands(prices, 20, 2),
    atr_14: calculateATR(ohlcData, 14)
  };
}

export default {
  calculateSMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateAllIndicators
};
