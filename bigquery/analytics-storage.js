import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

const bigquery = new BigQuery();
const DATASET_ID = 'magi_analytics';
const TABLE_ID = 'magi_investment_analysis';

/**
 * Save investment analysis to BigQuery
 * Designed for /api/analyze endpoint data structure
 */
export async function saveInvestmentAnalysis(symbol, companyName, aiRecommendations, consensus) {
  try {
    // Extract action and confidence for each AI provider
    const getAIData = (provider) => {
      const rec = aiRecommendations.find(r => r.provider === provider);
      return {
        action: rec?.action || 'HOLD',
        confidence: rec?.confidence || 0
      };
    };

    const grok = getAIData('grok');
    const gemini = getAIData('gemini');
    const claude = getAIData('claude');
    const mistral = getAIData('mistral');

    const row = {
      analysis_id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      symbol: symbol,
      company_name: companyName || `${symbol} Inc.`,
      grok_action: grok.action,
      grok_confidence: grok.confidence,
      gemini_action: gemini.action,
      gemini_confidence: gemini.confidence,
      claude_action: claude.action,
      claude_confidence: claude.confidence,
      mistral_action: mistral.action,
      mistral_confidence: mistral.confidence,
      consensus_action: consensus?.recommendation || 'HOLD',
      average_confidence: parseFloat(consensus?.average_confidence) || 0,
      buy_count: consensus?.buy || 0,
      hold_count: consensus?.hold || 0,
      sell_count: consensus?.sell || 0,
      created_at: new Date().toISOString()
    };

    await bigquery.dataset(DATASET_ID).table(TABLE_ID).insert([row]);
    console.log(`[BIGQUERY] Saved investment analysis for ${symbol}`);
    return row.analysis_id;

  } catch (error) {
    console.error('[BIGQUERY] Save investment analysis failed:', error.message);
    throw error;
  }
}
