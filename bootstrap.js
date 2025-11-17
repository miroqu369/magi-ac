'use strict';
const express = require('express');

// グローバル app
global.app = express();
app.use(express.json());

// Health Check を先に登録（initialization 待たない）
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    version: '3.5.0-with-magi-stg',
    service: 'MAGI Analytics Center',
    timestamp: new Date().toISOString()
  });
});

// アプリケーション本体を読み込み
try {
  require('./src/index.js');
} catch (error) {
  console.error('App load error:', error);
}

const PORT = Number(process.env.PORT) || 8888;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cloud Run listening on port ${PORT}`);
});
