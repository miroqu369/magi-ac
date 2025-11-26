import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const XAI_API_KEY = (process.env.XAI_API_KEY || '').trim();
const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const MISTRAL_API_KEY = (process.env.MISTRAL_API_KEY || '').trim();

function createPrompt(symbol, data, perspective) {
  return `あなたは株式投資の専門家です。${perspective}の観点から以下の銘柄を分析してください。

銘柄: ${symbol}
会社名: ${data.company}
現在価格: $${data.currentPrice}
前日終値: $${data.previousClose}

テクニカル指標:
- RSI: ${data.indicators?.rsi || 'N/A'}
- MACD: ${JSON.stringify(data.indicators?.macd || {})}
- ボリンジャーバンド: ${JSON.stringify(data.indicators?.bollingerBands || {})}

シグナル:
- RSI: ${data.signals?.rsiSignal || 'N/A'}
- MACD: ${data.signals?.macdSignal || 'N/A'}
- BB: ${data.signals?.bbSignal || 'N/A'}

以下のJSON形式のみで回答してください（他のテキストは不要）:
{"action": "BUY or HOLD or SELL", "confidence": 0-100の数値, "reasoning": "判断理由を日本語で1-2文"}`;
}

function parseAIResponse(content) {
  // 制御文字と改行を正規化
  let cleaned = content.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');
  // JSONを抽出
  const match = cleaned.match(/\{[^{}]*"action"[^{}]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }
  throw new Error('No valid JSON found');
}

async function analyzeWithGrok(symbol, data) {
  if (!XAI_API_KEY || XAI_API_KEY.includes('test')) {
    return { provider: 'grok', error: 'API key not configured', skip: true };
  }
  
  try {
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions',
      {
        model: 'grok-2-latest',
        messages: [{ role: 'user', content: createPrompt(symbol, data, '創造的トレンド分析・イノベーション評価') }],
        temperature: 0.5
      },
      { headers: { 'Authorization': `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    
    const content = response.data.choices[0].message.content;
    const json = parseAIResponse(content);
    return { provider: 'grok', role: 'Unit-B2 (創造的分析)', ...json };
  } catch (error) {
    return { provider: 'grok', error: error.message };
  }
}

async function analyzeWithGemini(symbol, data) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('test')) {
    return { provider: 'gemini', error: 'API key not configured', skip: true };
  }
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(createPrompt(symbol, data, '論理的数値分析・財務評価'));
    const content = result.response.text();
    const json = parseAIResponse(content);
    return { provider: 'gemini', role: 'Unit-M1 (論理的分析)', ...json };
  } catch (error) {
    return { provider: 'gemini', error: error.message };
  }
}

async function analyzeWithClaude(symbol, data) {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes('test')) {
    return { provider: 'claude', error: 'API key not configured', skip: true };
  }
  
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: createPrompt(symbol, data, '企業価値・ESG・長期持続性評価') }]
    });
    const content = message.content[0].text;
    const json = parseAIResponse(content);
    return { provider: 'claude', role: 'Unit-C3 (人間的分析)', ...json };
  } catch (error) {
    return { provider: 'claude', error: error.message };
  }
}

async function analyzeWithMistral(symbol, data) {
  if (!MISTRAL_API_KEY || MISTRAL_API_KEY.includes('test')) {
    return { provider: 'mistral', error: 'API key not configured', skip: true };
  }
  
  try {
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: createPrompt(symbol, data, 'リスク分析・ポートフォリオ戦略') }],
        temperature: 0.3
      },
      { headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    
    const content = response.data.choices[0].message.content;
    const json = parseAIResponse(content);
    return { provider: 'mistral', role: 'Unit-R4 (リスク分析)', ...json };
  } catch (error) {
    return { provider: 'mistral', error: error.message };
  }
}

function calculateConsensus(results) {
  const validResults = results.filter(r => r.action && !r.error);
  
  if (validResults.length === 0) {
    return { recommendation: 'HOLD', confidence: 0, reasoning: 'No valid AI responses' };
  }
  
  const votes = { BUY: 0, HOLD: 0, SELL: 0 };
  let totalConfidence = 0;
  
  validResults.forEach(r => {
    const action = r.action.toUpperCase();
    if (votes.hasOwnProperty(action)) {
      votes[action]++;
    }
    totalConfidence += r.confidence || 0;
  });
  
  const avgConfidence = Math.round(totalConfidence / validResults.length);
  const recommendation = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  
  return {
    recommendation,
    confidence: avgConfidence,
    votes,
    validResponses: validResults.length,
    totalAIs: 4
  };
}

export async function analyzeWithConsensus(symbol, data) {
  console.log(`[AI-Consensus] Starting 4-AI analysis for ${symbol}`);
  
  const results = await Promise.all([
    analyzeWithGrok(symbol, data),
    analyzeWithGemini(symbol, data),
    analyzeWithClaude(symbol, data),
    analyzeWithMistral(symbol, data)
  ]);
  
  const consensus = calculateConsensus(results);
  console.log(`[AI-Consensus] Complete: ${consensus.recommendation} (${consensus.confidence}% confidence)`);
  
  return {
    symbol,
    timestamp: new Date().toISOString(),
    aiAnalysis: results,
    consensus
  };
}
