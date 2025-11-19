'use strict';
const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT) || 8080;

// 初期化
const bq = new BigQuery({ projectId: 'screen-share-459802', location: 'asia-northeast1' });
const storage = new Storage();
const bucket = storage.bucket('magi-ac-data');
const dataset = bq.dataset('magi_ac');

app.use(express.json());
app.use(express.static('public'));

// ===============================
// ヘルスチェック
// ===============================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '4.0.0',
    service: 'MAGI Analytics Center',
    timestamp: new Date().toISOString(),
    components: {
      bigquery: !!bq,
      storage: !!storage,
      magi_core: !!process.env.MAGI_URL
    }
  });
});

// ===============================
// 株式分析API
// ===============================
app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: 'ティッカーシンボルが必要です' });
    }

    console.log(`📊 分析開始: ${symbol}`);

    // 1. 財務データ取得（モックデータ）
    const financialData = getMockFinancialData(symbol.toUpperCase());

    // 2. MAGI Coreへ問い合わせ（環境変数が設定されている場合）
    let magiAnalysis = null;
    if (process.env.MAGI_URL && process.env.MAGI_TOKEN) {
      try {
        magiAnalysis = await queryMAGI(symbol, financialData);
      } catch (err) {
        console.warn('⚠️ MAGI問い合わせ失敗（続行）:', err.message);
      }
    }

    // 3. 結果をまとめる
    const result = {
      symbol: symbol.toUpperCase(),
      company: financialData.company,
      timestamp: new Date().toISOString(),
      financialData,
      analysis: magiAnalysis ? magiAnalysis.final : '分析データのみ取得',
      aiRecommendations: magiAnalysis ? extractRecommendations(magiAnalysis) : []
    };

    // 4. Cloud Storageに保存
    await saveToStorage(result);

    // 5. BigQueryに保存
    await saveToBigQuery(result);

    res.json(result);

  } catch (error) {
    console.error('❌ 分析エラー:', error);
    res.status(500).json({
      error: 'サーバーエラー',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===============================
// BigQuery分析API
// ===============================
app.get('/api/analytics/latest/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const query = `
      SELECT * FROM \`screen-share-459802.magi_ac.financials_raw\`
      WHERE symbol = @symbol
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    const [rows] = await bq.query({
      query,
      params: { symbol },
      location: 'asia-northeast1'
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'データが見つかりません' });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error('❌ BigQueryエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/history/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const days = parseInt(req.query.days) || 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const query = `
      SELECT * FROM \`screen-share-459802.magi_ac.financials_raw\`
      WHERE symbol = @symbol AND timestamp >= @cutoff
      ORDER BY timestamp ASC
    `;

    const [rows] = await bq.query({
      query,
      params: { symbol, cutoff },
      location: 'asia-northeast1'
    });

    res.json({ symbol, days, count: rows.length, data: rows });

  } catch (error) {
    console.error('❌ BigQueryエラー:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// ヘルパー関数
// ===============================

// モック財務データ生成
function getMockFinancialData(symbol) {
  const mockData = {
    'AAPL': { company: 'Apple Inc.', price: 225.50, pe: 28.5, marketCap: 3500000000000 },
    'GOOGL': { company: 'Alphabet Inc.', price: 140.25, pe: 22.3, marketCap: 1800000000000 },
    'MSFT': { company: 'Microsoft Corp.', price: 380.50, pe: 32.1, marketCap: 2800000000000 },
    'NVDA': { company: 'NVIDIA Corp.', price: 495.20, pe: 45.2, marketCap: 1200000000000 }
  };

  const data = mockData[symbol] || { company: symbol, price: 100, pe: 20, marketCap: 1000000000000 };

  return {
    symbol,
    company: data.company,
    currentPrice: data.price,
    previousClose: data.price - 1,
    marketCap: data.marketCap,
    pe: data.pe,
    eps: data.price / data.pe,
    currency: 'USD'
  };
}

// MAGI Coreへ問い合わせ
async function queryMAGI(symbol, financialData) {
  const prompt = `
企業名: ${financialData.company}
ティッカー: ${symbol}
現在株価: ${financialData.currentPrice} ${financialData.currency}
PER: ${financialData.pe}
時価総額: ${(financialData.marketCap / 1e9).toFixed(2)}B

この企業の財務状況を分析し、投資判断（買い/保有/売り）と確信度を提供してください。
  `.trim();

  const response = await axios.post(
    `${process.env.MAGI_URL}/api/consensus`,
    {
      prompt,
      meta: { mode: 'integration', temperature: 0.2 }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.MAGI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    }
  );

  return response.data;
}

// AI推奨を抽出
function extractRecommendations(magiResult) {
  if (!magiResult.candidates) return [];

  return magiResult.candidates.map(c => {
    const text = c.text || '';
    let action = 'HOLD';
    let confidence = 50;

    if (text.match(/買い|BUY/i)) action = 'BUY';
    else if (text.match(/売り|SELL/i)) action = 'SELL';

    const confMatch = text.match(/確信度[：:]\s*(\d+)/i);
    if (confMatch) confidence = parseInt(confMatch[1]);

    return {
      provider: c.provider,
      magi_unit: c.magi_unit,
      action,
      confidence,
      text: text.substring(0, 500)
    };
  });
}

// Cloud Storageに保存
async function saveToStorage(data) {
  try {
    const now = new Date();
    const path = `raw/financials/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${data.symbol}_${now.toISOString().replace(/[:.]/g, '-')}.json`;

    await bucket.file(path).save(JSON.stringify(data, null, 2), {
      contentType: 'application/json',
      metadata: {
        symbol: data.symbol,
        savedAt: now.toISOString()
      }
    });

    console.log(`💾 保存完了: gs://magi-ac-data/${path}`);
  } catch (error) {
    console.warn('⚠️ Storage保存失敗（非致命的）:', error.message);
  }
}

// BigQueryに保存
async function saveToBigQuery(data) {
  try {
    const table = dataset.table('financials_raw');
    
    // テーブルが存在しない場合は作成
    const [exists] = await table.exists();
    if (!exists) {
      console.log('📊 BigQueryテーブルを作成中...');
      await table.create({
        schema: [
          { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
          { name: 'company', type: 'STRING', mode: 'REQUIRED' },
          { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
          { name: 'financialData', type: 'JSON', mode: 'NULLABLE' },
          { name: 'analysis', type: 'STRING', mode: 'NULLABLE' }
        ]
      });
      console.log('✅ BigQueryテーブル作成完了: financials_raw');
    }

    const row = {
      symbol: data.symbol,
      company: data.company,
      timestamp: new Date().toISOString(),
      financialData: data.financialData,
      analysis: data.analysis || null
    };

    await table.insert([row]);
    console.log(`📊 BigQuery保存完了: ${data.symbol}`);
  } catch (error) {
    console.warn('⚠️ BigQuery保存失敗（非致命的）:', error.message);
  }
}

// ===============================
// サーバー起動
// ===============================
async function initialize() {
  try {
    // BigQuery dataset確認・作成
    const [exists] = await dataset.exists();
    if (!exists) {
      await bq.createDataset('magi_ac', { location: 'asia-northeast1' });
      console.log('✅ Dataset作成: magi_ac');
    }

    // Cloud Storage bucket確認・作成
    const [bucketExists] = await bucket.exists();
    if (!bucketExists) {
      await storage.createBucket('magi-ac-data', { location: 'ASIA-NORTHEAST1' });
      console.log('✅ Bucket作成: magi-ac-data');
    }

  } catch (error) {
    console.warn('⚠️ 初期化警告:', error.message);
  }
}

initialize().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 MAGI Analytics Center v4.0');
    console.log(`📍 ポート: ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📊 BigQuery: screen-share-459802.magi_ac`);
    console.log(`💾 Storage: gs://magi-ac-data`);
    console.log('✅ 起動完了');
  });
});
