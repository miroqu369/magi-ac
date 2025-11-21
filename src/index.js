import express from "express";
import dotenv from "dotenv";
import { CohereClientV2 } from "cohere-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

let cohereClient = null;

if (process.env.COHERE_API_KEY) {
  cohereClient = new CohereClientV2({ token: process.env.COHERE_API_KEY });
  console.log("✓ Cohere initialized");
}

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "magi-ac (Analytics Center with Cohere)",
    version: "4.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/status", (req, res) => {
  res.json({
    service: "magi-ac",
    cohere: cohereClient ? "ready" : "not available",
    port: PORT,
  });
});

app.post("/api/document/earnings-analysis", async (req, res) => {
  if (!cohereClient) {
    return res.status(503).json({ error: "Cohere not initialized" });
  }

  try {
    const { document_text, symbol } = req.body;
    if (!document_text || !symbol) {
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log(`[EARNINGS] ${symbol}`);

    const response = await cohereClient.chat({
      model: "command-r-plus",
      messages: [
        {
          role: "user",
          content: `Extract financial metrics for ${symbol}. Report: ${document_text.substring(0, 2000)}`,
        },
      ],
      maxTokens: 800,
    });

    res.json({
      success: true,
      symbol,
      analysis: response.message.content[0].text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/document/sentiment", async (req, res) => {
  if (!cohereClient) {
    return res.status(503).json({ error: "Cohere not initialized" });
  }

  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) {
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log(`[SENTIMENT] ${symbol}`);

    const response = await cohereClient.chat({
      model: "command-r-plus",
      messages: [
        {
          role: "user",
          content: `Analyze sentiment for ${symbol}. News: ${text.substring(0, 1500)}`,
        },
      ],
      maxTokens: 500,
    });

    res.json({
      success: true,
      symbol,
      sentiment: response.message.content[0].text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/document/news-analysis", async (req, res) => {
  if (!cohereClient) {
    return res.status(503).json({ error: "Cohere not initialized" });
  }

  try {
    const { news_text, symbol } = req.body;
    if (!news_text || !symbol) {
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log(`[NEWS] ${symbol}`);

    const response = await cohereClient.chat({
      model: "command-r-plus",
      messages: [
        {
          role: "user",
          content: `Analyze company news for ${symbol}. News: ${news_text.substring(0, 1500)}`,
        },
      ],
      maxTokens: 600,
    });

    res.json({
      success: true,
      symbol,
      news_analysis: response.message.content[0].text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/document/risk-analysis", async (req, res) => {
  if (!cohereClient) {
    return res.status(503).json({ error: "Cohere not initialized" });
  }

  try {
    const { document_text, symbol } = req.body;
    if (!document_text || !symbol) {
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log(`[RISK] ${symbol}`);

    const response = await cohereClient.chat({
      model: "command-r-plus",
      messages: [
        {
          role: "user",
          content: `Identify risks for ${symbol}. Report: ${document_text.substring(0, 2000)}`,
        },
      ],
      maxTokens: 800,
    });

    res.json({
      success: true,
      symbol,
      risk_analysis: response.message.content[0].text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/document/comprehensive-analysis", async (req, res) => {
  if (!cohereClient) {
    return res.status(503).json({ error: "Cohere not initialized" });
  }

  try {
    const { document_text, symbol } = req.body;
    if (!document_text || !symbol) {
      return res.status(400).json({ error: "Missing fields" });
    }

    console.log(`[COMPREHENSIVE] ${symbol}`);
    const startTime = Date.now();

    const [earnings, risks, summary] = await Promise.all([
      cohereClient.chat({
        model: "command-r-plus",
        messages: [
          {
            role: "user",
            content: `Extract metrics for ${symbol}. Report: ${document_text.substring(0, 1500)}`,
          },
        ],
        maxTokens: 400,
      }),
      cohereClient.chat({
        model: "command-r-plus",
        messages: [
          {
            role: "user",
            content: `List top risks for ${symbol}. Report: ${document_text.substring(0, 1500)}`,
          },
        ],
        maxTokens: 400,
      }),
      cohereClient.chat({
        model: "command-r-plus",
        messages: [
          {
            role: "user",
            content: `Summarize ${symbol} in 3 points. Report: ${document_text.substring(0, 1500)}`,
          },
        ],
        maxTokens: 300,
      }),
    ]);

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      symbol,
      comprehensive: {
        earnings: earnings.message.content[0].text,
        risks: risks.message.content[0].text,
        summary: summary.message.content[0].text,
      },
      processing_time_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  MAGI Analytics Center v4.0            ║
║  Cohere Integration Ready              ║
╚════════════════════════════════════════╝

Server: http://localhost:${PORT}
Status: ${cohereClient ? "✓ Ready" : "⚠ Limited"}
Time: ${new Date().toISOString()}
  `);
});

export default app;
