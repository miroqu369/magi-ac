const express = require('express');
const MagiStorage = require('@magi/storage');
const YahooFinanceCollector = require('./collectors/yahoo-finance');
const MagiClient = require('./analyzers/magi-client');
const ExternalTablesManager = require('./bigquery/external-tables');
const AnalyticsQueries = require('./bigquery/queries');

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json());
app.use(express.static('public'));

const storage = new MagiStorage('magi-ac-data');
const yahooCollector = new YahooFinanceCollector();
const magiClient = new MagiClient(process.env.MAGI_URL, process.env.MAGI_TOKEN);
const analytics = new AnalyticsQueries();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    version: '3.1.0',
    role: 'Analytics Center',
    components: ['BigQuery', 'MAGI Storage', 'MAGI Core']
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    
    console.log(`📊 Analyzing ${symbol}...`);
    
    const financialData = await yahooCollector.getQuote(symbol.toUpperCase());
    const prompt = magiClient.buildAnalysisPrompt(symbol, financialData);
    const magiResult = await magiClient.analyze(prompt, 'integration');
    
    const aiRecommendations = magiResult.candidates.map(c => {
      const rec = magiClient.extractRecommendation(c.text);
      return { 
        provider: c.provider, 
        magi_unit: c.magi_unit,
        action: rec.action, 
        confidence: rec.confidence,
        text: c.text
      };
    });
    
    const result = {
      symbol: symbol.toUpperCase(),
      company: financialData.company,
      financialData,
      analysis: magiResult.final,
      aiRecommendations,
      timestamp: new Date().toISOString()
    };

    // MAGI Storageに保存
    try {
      const now = new Date();
      const path = `raw/financials/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${symbol.toUpperCase()}_${now.toISOString().replace(/[:.]/g,'-')}.json`;
      await storage.save(result, path);
      console.log('✅ Data saved to Cloud Storage');
    } catch (saveError) {
      console.error('Storage save failed (non-fatal):', saveError.message);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// BigQuery分析API
app.get('/api/analytics/latest/:symbol', async (req, res) => {
  try {
    const latest = await analytics.getLatestPrice(req.params.symbol.toUpperCase());
    if (!latest) {
      return res.status(404).json({ error: 'No data found' });
    }
    res.json(latest);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/history/:symbol', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const history = await analytics.getPriceHistory(req.params.symbol.toUpperCase(), days);
    res.json({ symbol: req.params.symbol.toUpperCase(), days, history });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/stats/:symbol', async (req, res) => {
  try {
    const stats = await analytics.getSymbolStats(req.params.symbol.toUpperCase());
    res.json(stats);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 MAGI Analytics Center v3.1 on port ' + PORT);
  console.log('📊 Components: BigQuery + MAGI Storage + MAGI Core');
  
  // External Table自動セットアップ
  const tables = new ExternalTablesManager();
  tables.setupFinancialsTable().catch(e => 
    console.error('External table setup:', e.message)
  );
});
