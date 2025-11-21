import { BigQuery } from "@google-cloud/bigquery";
import { v4 as uuidv4 } from "uuid";

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "screen-share-459802",
});

const dataset = bigquery.dataset("magi_analytics");

/**
 * 投資判断データを保存
 */
export async function saveInvestmentAnalysis(symbol, analysisData) {
  try {
    const table = dataset.table("magi_investment_analysis");
    
    const rows = [{
      analysis_id: uuidv4(),
      date: new Date().toISOString().split("T")[0],
      symbol: symbol,
      company_name: analysisData.company || "",
      
      grok_action: analysisData.grok?.action || "UNKNOWN",
      grok_confidence: analysisData.grok?.confidence || 0,
      
      gemini_action: analysisData.gemini?.action || "UNKNOWN",
      gemini_confidence: analysisData.gemini?.confidence || 0,
      
      claude_action: analysisData.claude?.action || "UNKNOWN",
      claude_confidence: analysisData.claude?.confidence || 0,
      
      mistral_action: analysisData.mistral?.action || "UNKNOWN",
      mistral_confidence: analysisData.mistral?.confidence || 0,
      
      consensus_action: analysisData.consensus?.action || "UNKNOWN",
      average_confidence: analysisData.consensus?.confidence || 0,
      buy_count: [
        analysisData.grok?.action,
        analysisData.gemini?.action,
        analysisData.claude?.action,
        analysisData.mistral?.action
      ].filter(a => a === "BUY").length,
      hold_count: [
        analysisData.grok?.action,
        analysisData.gemini?.action,
        analysisData.claude?.action,
        analysisData.mistral?.action
      ].filter(a => a === "HOLD").length,
      sell_count: [
        analysisData.grok?.action,
        analysisData.gemini?.action,
        analysisData.claude?.action,
        analysisData.mistral?.action
      ].filter(a => a === "SELL").length,
      
      created_at: new Date(),
    }];
    
    await table.insert(rows);
    console.log(`✓ BigQuery に投資判断を保存: ${symbol}`);
    return true;
  } catch (error) {
    console.error("❌ BigQuery 保存エラー:", error);
    return false;
  }
}

/**
 * 財務データを保存
 */
export async function saveFinancialData(symbol, financialData) {
  try {
    const table = dataset.table("magi_financial_data");
    
    const rows = [{
      data_id: uuidv4(),
      date: new Date().toISOString().split("T")[0],
      symbol: symbol,
      
      current_price: financialData.currentPrice || null,
      previous_close: financialData.previousClose || null,
      market_cap: financialData.marketCap || null,
      
      pe_ratio: financialData.pe || null,
      eps: financialData.eps || null,
      dividend_yield: financialData.dividend_yield || null,
      
      revenue: financialData.revenue || null,
      net_income: financialData.net_income || null,
      
      created_at: new Date(),
    }];
    
    await table.insert(rows);
    console.log(`✓ BigQuery に財務データを保存: ${symbol}`);
    return true;
  } catch (error) {
    console.error("❌ BigQuery 保存エラー:", error);
    return false;
  }
}

/**
 * センチメント分析を保存
 */
export async function saveSentimentAnalysis(symbol, sentimentData) {
  try {
    const table = dataset.table("magi_sentiment_analysis");
    
    const rows = [{
      sentiment_id: uuidv4(),
      symbol: symbol,
      
      sentiment: sentimentData.sentiment || "neutral",
      sentiment_score: sentimentData.sentiment_score || 0,
      impact_level: sentimentData.impact_level || "medium",
      
      created_at: new Date(),
    }];
    
    await table.insert(rows);
    console.log(`✓ BigQuery にセンチメント分析を保存: ${symbol}`);
    return true;
  } catch (error) {
    console.error("❌ BigQuery 保存エラー:", error);
    return false;
  }
}

/**
 * 過去 30 日の投資判断を取得
 */
export async function getInvestmentAnalysisLast30Days(symbol) {
  try {
    const query = `
      SELECT *
      FROM \`screen-share-459802.magi_analytics.magi_investment_analysis\`
      WHERE symbol = @symbol
      AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      ORDER BY date DESC
      LIMIT 100
    `;
    
    const options = {
      query: query,
      location: "asia-northeast1",
      params: { symbol: symbol },
    };
    
    const [rows] = await bigquery.query(options);
    console.log(`✓ BigQuery から過去30日のデータを取得: ${symbol}`);
    return rows;
  } catch (error) {
    console.error("❌ BigQuery クエリエラー:", error);
    return [];
  }
}

export default {
  saveInvestmentAnalysis,
  saveFinancialData,
  saveSentimentAnalysis,
  getInvestmentAnalysisLast30Days,
};
