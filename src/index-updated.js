import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { analyzeSymbol } from './analytics/technical-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// technical-analyzer モジュール
const techModule = await import('./analytics/technical-analyzer.js');
const { analyzeSymbol: techAnalyze } = techModule;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'magi-ac', timestamp: new Date().toISOString() });
});

app.post('/api/analyze', async (req, res) => {
  const { symbol } = req.body;
  
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  try {
    // テクニカル分析を取得
    const technicalData = await techAnalyze(symbol);
    
    res.json({
      success: true,
      symbol,
      technical: technicalData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`📊 MAGI Analytics Center running on port ${PORT}`);
});
