import express from "express";
import dotenv from "dotenv";
import { loadSpecifications, enhancePromptWithSpec } from "../spec-client.js";

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
app.use(express.urlencoded({ limit: "50mb" }));

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

  // 仕様書をプロンプトに挿入（将来の拡張用）
  const analysisPrompt = `Analyze ${symbol} for investment recommendation`;
  const enhancedPrompt = specifications 
    ? enhancePromptWithSpec(analysisPrompt, specifications)
    : analysisPrompt;

  console.log('📊 Analyzing', symbol, 'with spec context:', !!specifications);

  // TODO: 実際の4つのAI呼び出しを実装
  res.json({
    symbol,
    company: "Apple Inc.",
    consensus: { recommendation: "BUY" },
    spec_context_used: !!specifications,
    prompt_preview: enhancedPrompt.substring(0, 150) + '...'
  });
});

app.listen(PORT, () => {
  console.log("✅ MAGI Analytics Center running on port " + PORT);
  console.log("📚 Specifications status:", specifications ? "loaded" : "pending");
});

export default app;
