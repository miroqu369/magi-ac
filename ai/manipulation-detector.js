/**
 * Manipulation Detector - AI Consensus Module
 * 4AI合議による株価操作判定
 */

import { getGrokRecommendation } from '../collectors/grok.js';
import { getGeminiRecommendation } from '../collectors/gemini.js';
import { getClaudeRecommendation } from '../collectors/claude.js';
import { getMistralRecommendation } from '../collectors/mistral.js';

/**
 * AI用の操作分析プロンプトを生成
 */
function generateManipulationPrompt(analysisData) {
  const { symbol, signals, volumeAnalysis, priceManipulation, shortInterest, darkPool, marketData } = analysisData;
  
  return `あなたは機関投資家の株価操作を分析する専門家です。

以下のデータを分析し、操作の可能性を評価してください：

【銘柄】${symbol}
【分析日時】${new Date().toISOString()}

【検出されたシグナル】(${signals.length}件)
${signals.map((s, i) => `${i + 1}. [${s.severity.toUpperCase()}] ${s.type}: ${s.description}`).join('\n')}

【出来高データ】
- 当日出来高: ${marketData.daily_volume.toLocaleString()}
- 20日平均: ${marketData.avg_volume_20d.toLocaleString()}
- 出来高比率: ${volumeAnalysis.metrics.volumeRatio.toFixed(2)}倍
- 異常検知: ${volumeAnalysis.anomaly_detected ? 'YES' : 'NO'}
- 異常スコア: ${volumeAnalysis.anomaly_score.toFixed(2)}

【価格パターン】
- 操作検出: ${priceManipulation.detected ? 'YES' : 'NO'}
- 操作スコア: ${priceManipulation.score}
- 検出パターン数: ${priceManipulation.patterns_count}
${priceManipulation.detected ? `- 詳細: ${Object.entries(priceManipulation.details)
    .filter(([_, p]) => p.detected)
    .map(([type, p]) => `${type} (confidence: ${p.confidence})`)
    .join(', ')}` : ''}

【空売りデータ】
- 最新空売り比率: ${shortInterest.latest_ratio}%
- トレンド: ${shortInterest.trend}
- 平均比率: ${shortInterest.avg_ratio}%
- 変動: ${shortInterest.change}%
- アラート: ${shortInterest.alert ? 'YES' : 'NO'}

【ダークプール活動】
- ダークプール比率: ${darkPool.percentage}%
- トレンド: ${darkPool.analysis.trend}
- 解釈: ${darkPool.analysis.interpretation}
- アラート: ${darkPool.analysis.alert ? 'YES' : 'NO'}

【市場データ】
- 現在価格: $${marketData.current_price.toFixed(2)}
- 分足データポイント数: ${marketData.intraday_points}

以下のJSON形式で回答してください：

{
  "manipulation_likelihood": "high/medium/low/none",
  "confidence": 0.0-1.0,
  "reasoning": "分析根拠を3-5文で説明",
  "key_concerns": ["懸念点1", "懸念点2", "懸念点3"],
  "recommended_action": "AVOID/CAUTION/MONITOR/SAFE のいずれか",
  "risk_factors": ["リスク要因1", "リスク要因2"]
}

必ずJSON形式のみで回答してください。`;
}

/**
 * AI回答をパース
 */
function parseAIResponse(aiResponse, aiName) {
  try {
    // aiResponseがすでにオブジェクトの場合（古い形式）
    if (typeof aiResponse === 'object' && aiResponse !== null) {
      if (aiResponse.manipulation_likelihood || aiResponse.action) {
        // 操作分析形式に変換
        return {
          ai: aiName,
          manipulation_likelihood: aiResponse.manipulation_likelihood || 'low',
          confidence: parseFloat(aiResponse.confidence) || 0.5,
          reasoning: aiResponse.reasoning || aiResponse.analysis || '',
          key_concerns: aiResponse.key_concerns || [],
          recommended_action: aiResponse.recommended_action || 'MONITOR',
          risk_factors: aiResponse.risk_factors || []
        };
      }
    }
    
    // 文字列の場合はJSON抽出
    const responseStr = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);
    
    // JSONブロックを抽出
    const jsonMatch = responseStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[AI-${aiName}] No JSON found in response`);
      return null;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // 必須フィールドの検証
    if (!parsed.manipulation_likelihood && !parsed.action) {
      console.error(`[AI-${aiName}] Missing required fields`);
      return null;
    }
    
    return {
      ai: aiName,
      manipulation_likelihood: parsed.manipulation_likelihood || 'low',
      confidence: parseFloat(parsed.confidence) || 0.5,
      reasoning: parsed.reasoning || '',
      key_concerns: parsed.key_concerns || [],
      recommended_action: parsed.recommended_action || 'MONITOR',
      risk_factors: parsed.risk_factors || []
    };
    
  } catch (error) {
    console.error(`[AI-${aiName}] Parse error:`, error.message);
    return null;
  }
}

/**
 * 4AI合議による操作判定
 */
export async function analyzeWithAIConsensus(analysisData) {
  const { symbol } = analysisData;
  
  console.log(`[AI-CONSENSUS] Starting 4-AI analysis for ${symbol}`);
  
  // プロンプト生成
  const prompt = generateManipulationPrompt(analysisData);
  
  // 4AIに並列でリクエスト (プロンプトをstockDataとして渡す)
  const aiPromises = [
    getGrokRecommendation({ prompt }, symbol).then(resp => parseAIResponse(resp, 'Grok')).catch(e => null),
    getGeminiRecommendation({ prompt }, symbol).then(resp => parseAIResponse(resp, 'Gemini')).catch(e => null),
    getClaudeRecommendation({ prompt }, symbol).then(resp => parseAIResponse(resp, 'Claude')).catch(e => null),
    getMistralRecommendation({ prompt }, symbol).then(resp => parseAIResponse(resp, 'Mistral')).catch(e => null)
  ];
  
  const results = await Promise.allSettled(aiPromises);
  
  // 成功した回答のみ取得
  const aiAnalyses = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
  
  console.log(`[AI-CONSENSUS] Received ${aiAnalyses.length}/4 valid responses`);
  
  if (aiAnalyses.length === 0) {
    console.error('[AI-CONSENSUS] No valid AI responses received');
    return {
      consensus_available: false,
      error: 'All AI analyses failed'
    };
  }
  
  // 合議結果を計算
  const consensus = calculateConsensus(aiAnalyses);
  
  return {
    consensus_available: true,
    responses_received: aiAnalyses.length,
    individual_analyses: aiAnalyses,
    consensus: consensus
  };
}

/**
 * AI合議結果を計算
 */
function calculateConsensus(aiAnalyses) {
  // 操作可能性のスコア化
  const likelihoodScores = {
    'high': 1.0,
    'medium': 0.6,
    'low': 0.3,
    'none': 0.0
  };
  
  const actionScores = {
    'AVOID': 1.0,
    'CAUTION': 0.7,
    'MONITOR': 0.4,
    'SAFE': 0.0
  };
  
  // 各AIの評価をスコア化
  const scores = aiAnalyses.map(ai => ({
    likelihood: likelihoodScores[ai.manipulation_likelihood] || 0.5,
    confidence: ai.confidence,
    action: actionScores[ai.recommended_action] || 0.4
  }));
  
  // 信頼度で重み付けした平均スコア
  const totalConfidence = scores.reduce((sum, s) => sum + s.confidence, 0);
  const weightedLikelihood = scores.reduce((sum, s) => 
    sum + (s.likelihood * s.confidence), 0
  ) / totalConfidence;
  
  const weightedAction = scores.reduce((sum, s) => 
    sum + (s.action * s.confidence), 0
  ) / totalConfidence;
  
  // 合議結果の決定
  let consensusLikelihood = 'low';
  if (weightedLikelihood >= 0.8) consensusLikelihood = 'high';
  else if (weightedLikelihood >= 0.5) consensusLikelihood = 'medium';
  else if (weightedLikelihood >= 0.2) consensusLikelihood = 'low';
  else consensusLikelihood = 'none';
  
  let consensusAction = 'MONITOR';
  if (weightedAction >= 0.8) consensusAction = 'AVOID';
  else if (weightedAction >= 0.5) consensusAction = 'CAUTION';
  else if (weightedAction >= 0.2) consensusAction = 'MONITOR';
  else consensusAction = 'SAFE';
  
  // 合意度を計算 (AIの評価がどれだけ一致しているか)
  const likelihoodVariance = calculateVariance(scores.map(s => s.likelihood));
  const agreement = Math.max(0, 1 - likelihoodVariance * 2);
  
  // 全AIの懸念点を統合
  const allConcerns = aiAnalyses.flatMap(ai => ai.key_concerns);
  const concernCounts = {};
  allConcerns.forEach(c => {
    concernCounts[c] = (concernCounts[c] || 0) + 1;
  });
  const topConcerns = Object.entries(concernCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([concern, count]) => ({ concern, mentioned_by: count }));
  
  // 全AIのリスク要因を統合
  const allRisks = aiAnalyses.flatMap(ai => ai.risk_factors);
  const riskCounts = {};
  allRisks.forEach(r => {
    riskCounts[r] = (riskCounts[r] || 0) + 1;
  });
  const topRisks = Object.entries(riskCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([risk, count]) => ({ risk, mentioned_by: count }));
  
  return {
    manipulation_likelihood: consensusLikelihood,
    confidence_score: weightedLikelihood.toFixed(2),
    agreement_level: agreement.toFixed(2),
    recommended_action: consensusAction,
    action_score: weightedAction.toFixed(2),
    top_concerns: topConcerns,
    top_risk_factors: topRisks,
    summary: generateConsensusSummary(consensusLikelihood, consensusAction, agreement, aiAnalyses.length)
  };
}

/**
 * 分散を計算
 */
function calculateVariance(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 合議サマリーを生成
 */
function generateConsensusSummary(likelihood, action, agreement, aiCount) {
  const agreementText = parseFloat(agreement) > 0.8 ? '高い合意' : 
                        parseFloat(agreement) > 0.5 ? '中程度の合意' : 
                        '見解が分かれる';
  
  const likelihoodText = {
    'high': '高い操作の可能性',
    'medium': '中程度の操作の可能性',
    'low': '低い操作の可能性',
    'none': '操作の兆候なし'
  }[likelihood];
  
  const actionText = {
    'AVOID': '投資を避けることを推奨',
    'CAUTION': '慎重な対応が必要',
    'MONITOR': '継続的な監視が推奨',
    'SAFE': '現時点では安全'
  }[action];
  
  return `${aiCount}つのAIによる分析結果: ${likelihoodText}。${agreementText}で、${actionText}。`;
}

/**
 * 簡易版AI分析 (単一AIのみ使用)
 */
export async function quickAIAnalysis(analysisData, aiName = 'gemini') {
  const prompt = generateManipulationPrompt(analysisData);
  
  let response;
  try {
    switch(aiName.toLowerCase()) {
      case 'grok':
        response = await getGrokRecommendation({ prompt }, analysisData.symbol);
        break;
      case 'claude':
        response = await getClaudeRecommendation({ prompt }, analysisData.symbol);
        break;
      case 'mistral':
        response = await getMistralRecommendation({ prompt }, analysisData.symbol);
        break;
      default:
        response = await getGeminiRecommendation({ prompt }, analysisData.symbol);
    }
    
    // レスポンスがnullの場合はMockを返す
    if (!response) {
      console.log(`[AI-${aiName}] No response, using mock data`);
      return generateMockAIResponse(analysisData, aiName);
    }
    
    const parsed = parseAIResponse(response, aiName);
    return parsed || generateMockAIResponse(analysisData, aiName);
    
  } catch (error) {
    console.error(`[AI-${aiName}] Analysis failed:`, error.message);
    return generateMockAIResponse(analysisData, aiName);
  }
}

/**
 * Mock AI response generator
 */
function generateMockAIResponse(analysisData, aiName) {
  const { signals } = analysisData;
  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  
  let likelihood = 'low';
  let confidence = 0.3;
  let action = 'MONITOR';
  
  if (highSeverityCount >= 3) {
    likelihood = 'high';
    confidence = 0.8;
    action = 'AVOID';
  } else if (highSeverityCount >= 2) {
    likelihood = 'medium';
    confidence = 0.6;
    action = 'CAUTION';
  } else if (signals.length >= 3) {
    likelihood = 'medium';
    confidence = 0.5;
    action = 'MONITOR';
  }
  
  return {
    ai: aiName,
    manipulation_likelihood: likelihood,
    confidence: confidence,
    reasoning: `${signals.length}件のシグナルを検出。うち高リスク${highSeverityCount}件。AIレスポンスが利用できないためデータベース分析のみ実施。`,
    key_concerns: signals.slice(0, 3).map(s => s.description),
    recommended_action: action,
    risk_factors: [`${signals.length}件の異常シグナル`, 'AIレスポンス取得失敗'],
    mock: true
  };
}
