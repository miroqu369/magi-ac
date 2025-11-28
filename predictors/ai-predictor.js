import axios from 'axios';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/**
 * 予測期間に応じたプロンプトを生成
 */
function generatePromptForHorizon(symbol, stockData, technicalData, horizon) {
  const baseInfo = `
銘柄: ${symbol}
会社名: ${stockData.shortName || stockData.longName}
現在価格: $${stockData.regularMarketPrice}
前日終値: $${stockData.regularMarketPreviousClose}
52週高値: $${stockData.fiftyTwoWeekHigh}
52週安値: $${stockData.fiftyTwoWeekLow}
時価総額: $${stockData.marketCap}
出来高: ${stockData.regularMarketVolume}
平均出来高: ${stockData.averageVolume}

テクニカル指標:
- RSI(14): ${technicalData.rsi?.toFixed(2) || 'N/A'}
- MACD: ${technicalData.macd?.value?.toFixed(2) || 'N/A'}
- ボリンジャーバンド: 上限${technicalData.bb?.upper?.toFixed(2) || 'N/A'}, 下限${technicalData.bb?.lower?.toFixed(2) || 'N/A'}
- 20日移動平均: $${technicalData.sma20?.toFixed(2) || 'N/A'}
- 50日移動平均: $${technicalData.sma50?.toFixed(2) || 'N/A'}
`;

  let horizonGuidance = '';
  
  switch(horizon) {
    case '1day':
      horizonGuidance = `
予測期間: 1日後（翌営業日）
分析重視項目:
- 短期トレンド（直近5日の価格推移）
- RSI・MACD等のオシレーター
- 出来高の急増・急減
- 前日の引け後ニュース
- 板の厚み・気配値
`;
      break;
    
    case '1week':
      horizonGuidance = `
予測期間: 1週間後（5営業日後）
分析重視項目:
- 短期トレンド（直近20日の価格推移）
- テクニカル指標の方向性
- 週次の出来高パターン
- 短期的なカタリスト（決算発表前後、製品発表等）
- セクター内相対強度
`;
      break;
    
    case '1month':
      horizonGuidance = `
予測期間: 1ヶ月後（約20営業日後）
分析重視項目:
- 中期トレンド（直近60日の価格推移）
- 移動平均線との位置関係
- 決算スケジュールとガイダンス
- 業界動向とマクロ経済指標
- テクニカル・ファンダメンタルのバランス
`;
      break;
    
    case '3months':
      horizonGuidance = `
予測期間: 3ヶ月後（約60営業日後）
分析重視項目:
- 四半期決算の内容とガイダンス
- セクターローテーションの可能性
- 競合他社との比較
- 新製品・サービスのローンチ予定
- マクロ経済環境（金利、GDP成長率等）
- ファンダメンタルズ重視（PER、EPS成長率等）
`;
      break;
    
    case '2years':
      horizonGuidance = `
予測期間: 2年後（約480営業日後）
分析重視項目:
- 長期成長ストーリー
- 市場シェアの拡大可能性
- 技術革新・ディスラプション
- 経営陣の実行力
- 業界構造の変化
- ESG・持続可能性
- 配当・自社株買い等の株主還元
- マクロ経済の長期見通し
`;
      break;
    
    default:
      horizonGuidance = `予測期間: ${horizon}`;
  }

  return `${baseInfo}\n${horizonGuidance}\n
以下のJSON形式で回答してください（JSONのみ、説明文不要）：
{
  "predicted_price": 予測価格（数値）,
  "direction": "UP" | "DOWN" | "NEUTRAL",
  "confidence": 0.0-1.0の信頼度（数値）,
  "reasoning": "予測理由を150文字以内で簡潔に"
}`;
}

/**
 * Grok AIから予測を取得
 */
export async function getGrokPrediction(symbol, stockData, technicalData, horizon) {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      console.warn('[GROK PREDICTOR] API key not configured');
      return null;
    }

    console.log(`[GROK PREDICTOR] Getting prediction for ${symbol} (${horizon})`);

    const prompt = generatePromptForHorizon(symbol, stockData, technicalData, horizon);

    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-2-latest',
        messages: [
          {
            role: 'system',
            content: 'あなたは革新的な視点を持つAI株価予測アナリストです。創造的かつ論理的に価格を予測してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 600
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const content = response.data.choices[0].message.content;
    const parsed = parseAIPredictionResponse(content, 'Grok');
    
    return parsed ? { ai: 'Grok', ...parsed } : null;

  } catch (error) {
    console.error('[GROK PREDICTOR] Error:', error.message);
    return null;
  }
}

/**
 * Gemini AIから予測を取得
 */
export async function getGeminiPrediction(symbol, stockData, technicalData, horizon) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[GEMINI PREDICTOR] API key not configured');
      return null;
    }

    console.log(`[GEMINI PREDICTOR] Getting prediction for ${symbol} (${horizon})`);

    const prompt = generatePromptForHorizon(symbol, stockData, technicalData, horizon);

    const response = await axios.post(
      `${GEMINI_API_BASE}/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ 
              text: 'あなたは科学的・論理的なAI株価予測アナリストです。データに基づいて正確に価格を予測してください。\n\n' + prompt 
            }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const content = response.data.candidates[0].content.parts[0].text;
    const parsed = parseAIPredictionResponse(content, 'Gemini');
    
    return parsed ? { ai: 'Gemini', ...parsed } : null;

  } catch (error) {
    console.error('[GEMINI PREDICTOR] Error:', error.message);
    return null;
  }
}

/**
 * Claude AIから予測を取得
 */
export async function getClaudePrediction(symbol, stockData, technicalData, horizon) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[CLAUDE PREDICTOR] API key not configured');
      return null;
    }

    console.log(`[CLAUDE PREDICTOR] Getting prediction for ${symbol} (${horizon})`);

    const prompt = generatePromptForHorizon(symbol, stockData, technicalData, horizon);

    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: 'あなたは人間的な視点を持つAI株価予測アナリストです。倫理的側面も考慮しながら価格を予測してください。\n\n' + prompt
          }
        ],
        temperature: 0.4
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const content = response.data.content[0].text;
    const parsed = parseAIPredictionResponse(content, 'Claude');
    
    return parsed ? { ai: 'Claude', ...parsed } : null;

  } catch (error) {
    console.error('[CLAUDE PREDICTOR] Error:', error.message);
    return null;
  }
}

/**
 * Mistral AIから予測を取得
 */
export async function getMistralPrediction(symbol, stockData, technicalData, horizon) {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.warn('[MISTRAL PREDICTOR] API key not configured');
      return null;
    }

    console.log(`[MISTRAL PREDICTOR] Getting prediction for ${symbol} (${horizon})`);

    const prompt = generatePromptForHorizon(symbol, stockData, technicalData, horizon);

    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'あなたはバランス重視のAI株価予測アナリストです。リスクとリターンを慎重に評価して価格を予測してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 600
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const content = response.data.choices[0].message.content;
    const parsed = parseAIPredictionResponse(content, 'Mistral');
    
    return parsed ? { ai: 'Mistral', ...parsed } : null;

  } catch (error) {
    console.error('[MISTRAL PREDICTOR] Error:', error.message);
    return null;
  }
}

/**
 * AIレスポンスをパース
 */
function parseAIPredictionResponse(content, aiName) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // バリデーション
      if (typeof parsed.predicted_price === 'number' &&
          ['UP', 'DOWN', 'NEUTRAL'].includes(parsed.direction) &&
          typeof parsed.confidence === 'number' &&
          parsed.confidence >= 0 && parsed.confidence <= 1 &&
          typeof parsed.reasoning === 'string') {
        return parsed;
      }
    }
    
    console.warn(`[${aiName} PREDICTOR] Invalid response format`);
    return null;
    
  } catch (error) {
    console.error(`[${aiName} PREDICTOR] Parse error:`, error.message);
    return null;
  }
}

/**
 * 4AI統合予測（並列実行）
 */
export async function get4AIPredictions(symbol, stockData, technicalData, horizon) {
  console.log(`[4AI PREDICTOR] Getting predictions from 4 AIs for ${symbol} (${horizon})`);
  
  const predictions = await Promise.all([
    getGrokPrediction(symbol, stockData, technicalData, horizon),
    getGeminiPrediction(symbol, stockData, technicalData, horizon),
    getClaudePrediction(symbol, stockData, technicalData, horizon),
    getMistralPrediction(symbol, stockData, technicalData, horizon)
  ]);
  
  const validPredictions = predictions.filter(p => p !== null);
  
  console.log(`[4AI PREDICTOR] Received ${validPredictions.length}/4 valid predictions`);
  
  return validPredictions;
}

/**
 * モック予測データ生成（enableAI=false用）
 */
export function generateMockPredictions(symbol, currentPrice, horizon) {
  console.log(`[MOCK PREDICTOR] Generating mock predictions for ${symbol} (${horizon})`);
  
  // horizon に応じて変動率を調整
  let volatilityFactor = 0.03; // デフォルト3%
  switch(horizon) {
    case '1day':
      volatilityFactor = 0.015; // 1.5%
      break;
    case '1week':
      volatilityFactor = 0.03; // 3%
      break;
    case '1month':
      volatilityFactor = 0.05; // 5%
      break;
    case '3months':
      volatilityFactor = 0.10; // 10%
      break;
    case '2years':
      volatilityFactor = 0.30; // 30%
      break;
  }
  
  return [
    {
      ai: 'Grok',
      predicted_price: currentPrice * (1 + volatilityFactor * 0.8),
      direction: 'UP',
      confidence: 0.72,
      reasoning: '革新的な成長戦略と市場拡大の可能性を評価。テクニカル指標も上昇トレンドを示唆。'
    },
    {
      ai: 'Gemini',
      predicted_price: currentPrice * (1 + volatilityFactor * 0.5),
      direction: 'UP',
      confidence: 0.68,
      reasoning: 'ファンダメンタルズは堅調だが、短期的な調整リスクも存在。慎重な買い推奨。'
    },
    {
      ai: 'Claude',
      predicted_price: currentPrice * (1 + volatilityFactor * 0.2),
      direction: 'NEUTRAL',
      confidence: 0.55,
      reasoning: '企業のESG取り組みは評価できるが、市場環境の不確実性が高い。様子見が賢明。'
    },
    {
      ai: 'Mistral',
      predicted_price: currentPrice * (1 + volatilityFactor * 0.6),
      direction: 'UP',
      confidence: 0.65,
      reasoning: 'リスク・リターンのバランスを考慮すると、中期的な上昇が期待できる。'
    }
  ];
}
