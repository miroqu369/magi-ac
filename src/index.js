import express from "express";
import dotenv from "dotenv";
import { loadSpecifications, enhancePromptWithSpec } from "../spec-client.js";
import { extractFinancials, analyzeSentiment, summarizeDocument } from "../collectors/cohere.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8888;

// 仕様書をメモリにキャッシュ
let specifications = null;

// 起動時に仕様書を読み込み
(async () => {
  try {
    specifications = await loadSpecifications();
    if (specifications) {
      console.log('✅ Specifications loaded and cached');
    } else {
      console.warn('⚠️  Failed to load specifications');
    }
  } catch (e) {
    console.warn('⚠️  Specification loading error:', e.message);
  }
})();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    version: "4.0.0",
    specifications_loaded: specifications !== null
  });
});

app.post("/api/analyze", (req, res) => {
  const { symbol } = req.body;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }

  const analysisPrompt = `Analyze ${symbol} for investment recommendation`;
  const enhancedPrompt = specifications 
    ? enhancePromptWithSpec(analysisPrompt, specifications)
    : analysisPrompt;

  console.log('📊 Analyzing', symbol, 'with spec context:', !!specifications);

  res.json({
    symbol,
    company: "Apple Inc.",
    consensus: { recommendation: "BUY" },
    spec_context_used: !!specifications,
    prompt_preview: enhancedPrompt.substring(0, 150) + '...'
  });
});

// ========== 決算書解析エンドポイント ==========

/**
 * 決算書から財務数値を抽出
 */
app.post("/api/document/extract-financials", async (req, res) => {
  try {
    const { symbol, document } = req.body;
    
    if (!symbol || !document) {
      return res.status(400).json({ 
        error: "symbol and document are required" 
      });
    }

    console.log('📄 Extracting financials for', symbol);
    
    const result = await extractFinancials(document, symbol);
    res.json(result);
  } catch (error) {
    console.error('Extract financials error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * センチメント分析
 */
app.post("/api/document/sentiment", async (req, res) => {
  try {
    const { symbol, text } = req.body;
    
    if (!symbol || !text) {
      return res.status(400).json({ 
        error: "symbol and text are required" 
      });
    }

    console.log('💭 Analyzing sentiment for', symbol);
    
    const result = await analyzeSentiment(text, symbol);
    res.json(result);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * 文書要約
 */
app.post("/api/document/summarize", async (req, res) => {
  try {
    const { symbol, document } = req.body;
    
    if (!symbol || !document) {
      return res.status(400).json({ 
        error: "symbol and document are required" 
      });
    }

    console.log('📝 Summarizing document for', symbol);
    
    const result = await summarizeDocument(document, symbol);
    res.json(result);
  } catch (error) {
    console.error('Document summarization error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log("✅ MAGI Analytics Center running on port " + PORT);
  console.log("📚 Specifications status:", specifications ? "loaded" : "pending");
  console.log("📄 Document analysis endpoints ready");
});

export default app;
