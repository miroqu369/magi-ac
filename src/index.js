import express from "express";
import dotenv from "dotenv";
import { loadSpecifications } from "../spec-client.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8888;

// ============ ロガー (構造化ログ) ============
const logger = {
  debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || ''),
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || '')
};

// ============ 標準レスポンス形式 ============
const successResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString()
});

const errorResponse = (error, statusCode = 500) => ({
  success: false,
  error: error.message || error,
  statusCode,
  timestamp: new Date().toISOString()
});

// ============ バリデーション ============
const validateSymbol = (symbol) => {
  if (!symbol) return { valid: false, error: 'Symbol is required' };
  if (typeof symbol !== 'string') return { valid: false, error: 'Symbol must be string' };
  if (symbol.length > 10) return { valid: false, error: 'Symbol too long' };
  if (!/^[A-Z0-9]+$/.test(symbol.toUpperCase())) return { valid: false, error: 'Invalid symbol format' };
  return { valid: true };
};

// ============ 初期化 ============
let specifications = null;

(async () => {
  try {
    specifications = await loadSpecifications();
    logger.info('✅ Specifications loaded successfully');
  } catch (e) {
    logger.warn('⚠️ Specification loading failed', e.message);
  }
})();

// ============ ミドルウェア ============
app.use(express.json({ limit: "50mb" }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// リクエストログ
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ============ 銘柄データ ============
const stockData = {
  "AAPL": { company: "Apple Inc.", recommendation: "BUY", confidence: 0.85 },
  "GOOGL": { company: "Alphabet Inc.", recommendation: "HOLD", confidence: 0.72 },
  "MSFT": { company: "Microsoft Corp.", recommendation: "BUY", confidence: 0.88 },
  "TSLA": { company: "Tesla Inc.", recommendation: "HOLD", confidence: 0.65 },
  "NVDA": { company: "NVIDIA Corp.", recommendation: "BUY", confidence: 0.92 },
  "META": { company: "Meta Platforms", recommendation: "HOLD", confidence: 0.68 },
  "AMZN": { company: "Amazon.com Inc.", recommendation: "BUY", confidence: 0.80 }
};

// ============ API エンドポイント ============

// Health Check
app.get("/health", (req, res) => {
  try {
    res.json(successResponse({ status: "healthy" }, "Health check passed"));
  } catch (e) {
    logger.error('Health check failed', e.message);
    res.status(500).json(errorResponse(e, 500));
  }
});

// Status
app.get("/status", (req, res) => {
  try {
    res.json(successResponse({
      server: "MAGI Analytics Center",
      port: PORT,
      specifications_loaded: !!specifications,
      uptime: process.uptime()
    }));
  } catch (e) {
    logger.error('Status endpoint failed', e.message);
    res.status(500).json(errorResponse(e, 500));
  }
});

// 銘柄分析
app.post("/api/analyze", (req, res) => {
  try {
    const { symbol } = req.body;
    
    // バリデーション
    const validation = validateSymbol(symbol);
    if (!validation.valid) {
      logger.warn('Validation failed', validation.error);
      return res.status(400).json(errorResponse(validation.error, 400));
    }
    
    const upperSymbol = symbol.toUpperCase();
    const data = stockData[upperSymbol] || {
      company: `${upperSymbol} Inc.`,
      recommendation: "HOLD",
      confidence: 0.50
    };
    
    logger.info(`Analysis completed for ${upperSymbol}`);
    res.json(successResponse({
      symbol: upperSymbol,
      company: data.company,
      consensus: {
        recommendation: data.recommendation,
        confidence: data.confidence
      },
      spec_context_used: !!specifications
    }, 'Analysis successful'));
    
  } catch (e) {
    logger.error('Analysis endpoint error', e.message);
    res.status(500).json(errorResponse(e, 500));
  }
});

// ============ エラーハンドリング ============
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err.message);
  res.status(500).json(errorResponse(err, 500));
});

app.use((req, res) => {
  logger.warn('404 Not Found', req.path);
  res.status(404).json(errorResponse('Endpoint not found', 404));
});

// ============ サーバー起動 ============
const server = app.listen(PORT, () => {
  logger.info(`✅ MAGI Analytics Center running on port ${PORT}`);
});

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
