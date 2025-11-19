// BigQuery テーブル: stock_metrics_historical
// スキーマ: symbol, company, fetch_date, fetch_time, price, per, eps, dividend_yield, market_cap, high_52w, low_52w, price_change_percent, data_source

async function saveToBigQueryImproved(data) {
  try {
    const table = dataset.table('stock_metrics_historical');
    
    // テーブルが存在しない場合は作成
    const [exists] = await table.exists();
    if (!exists) {
      console.log('📊 BigQuery テーブルを作成中: stock_metrics_historical');
      await table.create({
        schema: [
          { name: 'symbol', type: 'STRING', mode: 'REQUIRED' },
          { name: 'company', type: 'STRING', mode: 'NULLABLE' },
          { name: 'fetch_date', type: 'DATE', mode: 'REQUIRED' },
          { name: 'fetch_time', type: 'TIMESTAMP', mode: 'REQUIRED' },
          { name: 'price', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'per', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'eps', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'dividend_yield', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'market_cap', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'high_52w', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'low_52w', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'price_change_percent', type: 'FLOAT64', mode: 'NULLABLE' },
          { name: 'data_source', type: 'STRING', mode: 'NULLABLE' },
          { name: 'raw_data', type: 'JSON', mode: 'NULLABLE' }
        ]
      });
      console.log('✅ BigQuery テーブル作成完了: stock_metrics_historical');
    }

    const fd = data.financialData || {};
    const row = {
      symbol: data.symbol,
      company: data.company,
      fetch_date: data.fetchDate,
      fetch_time: data.timestamp,
      price: fd.currentPrice || null,
      per: fd.per || null,
      eps: fd.eps || null,
      dividend_yield: fd.dividendYield || null,
      market_cap: fd.marketCap || null,
      high_52w: fd.fiftyTwoWeekHigh || null,
      low_52w: fd.fiftyTwoWeekLow || null,
      price_change_percent: data.priceChange?.percent || null,
      data_source: fd.dataSource || 'unknown',
      raw_data: fd
    };

    await table.insert([row]);
    console.log(`📊 BigQuery 保存完了: ${data.symbol} (${data.timestamp})`);
    
    return true;
  } catch (error) {
    console.error('❌ BigQuery 保存エラー:', error);
    throw error;
  }
}

module.exports = { saveToBigQueryImproved };
