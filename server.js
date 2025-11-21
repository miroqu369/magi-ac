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
  console.log("Cohere ready");
}

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "magi-ac",
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
  if (!cohereClient) return res.status(503).json({ error: "Cohere not ready" });

  try {
    const { document_text, symbol } = req.body;
    if (!document_text || !symbol) return res.status(400).json({ error: "Missing fields" });

    const response = await cohereClient.chat({
      model: "command-r-plus-08-2024",
      messages: [{ role: "user", content: `Extract financial metrics for ${symbol}. Report: ${document_text.substring(0, 2000)}` }],
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
  if (!cohereClient) return res.status(503).json({ error: "Cohere not ready" });

  try {
    const { text, symbol } = req.body;
    if (!text || !symbol) return res.status(400).json({ error: "Missing fields" });

    const response = await cohereClient.chat({
      model: "command-r-plus-08-2024",
      messages: [{ role: "user", content: `Analyze sentiment for ${symbol}. News: ${text.substring(0, 1500)}` }],
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
  if (!cohereClient) return res.status(503).json({ error: "Cohere not ready" });

  try {
    const { news_text, symbol } = req.body;
    if (!news_text || !symbol) return res.status(400).json({ error: "Missing fields" });

    const response = await cohereClient.chat({
      model: "command-r-plus-08-2024",
      messages: [{ role: "user", content: `Analyze company news for ${symbol}. News: ${news_text.substring(0, 1500)}` }],
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
  if (!cohereClient) return res.status(503).json({ error: "Cohere not ready" });

  try {
    const { document_text, symbol } = req.body;
    if (!document_text || !symbol) return res.status(400).json({ error: "Missing fields" });

    const response = await cohereClient.chat({
      model: "command-r-plus-08-2024",
      messages: [{ role: "user", content: `Identify risks for ${symbol}. Report: ${document_text.substring(0, 2000)}` }],
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
  if (!cohereClient) return res.status(503).json({ error: "Cohere not ready" });

  try {
    const { document_text, symbol } = req.body;
    if (!document_text || !symbol) return res.status(400).json({ error: "Missing fields" });

    const startTime = Date.now();

    const [earnings, risks, summary] = await Promise.all([
      cohereClient.chat({
        model: "command-r-plus-08-2024",
        messages: [{ role: "user", content: `Extract metrics for ${symbol}. Report: ${document_text.substring(0, 1500)}` }],
        maxTokens: 400,
      }),
      cohereClient.chat({
        model: "command-r-plus-08-2024",
        messages: [{ role: "user", content: `List top risks for ${symbol}. Report: ${document_text.substring(0, 1500)}` }],
        maxTokens: 400,
      }),
      cohereClient.chat({
        model: "command-r-plus-08-2024",
        messages: [{ role: "user", content: `Summarize ${symbol} in 3 points. Report: ${document_text.substring(0, 1500)}` }],
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
  console.log(`MAGI Analytics Center v4.0 - Cohere Integration`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Status: ${cohereClient ? "Ready" : "Limited"}`);
});

export default app;

// ====== PDF ANALYSIS ======
import multer from "multer";
import pdfParse from "pdf-parse";
import fs from "fs";

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/document/upload-earnings-pdf", upload.single("file"), async (req, res) => {
  if (!cohereClient) return res.status(503).json({ error: "Cohere not ready" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });

    console.log(`[PDF] Processing earnings report for ${symbol}`);

    let documentText = "";

    // PDF解析
    if (req.file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(req.file.buffer);
      documentText = pdfData.text;
    } else if (req.file.mimetype === "text/plain") {
      documentText = req.file.buffer.toString("utf-8");
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use PDF or TXT." });
    }

    console.log(`[PDF] Extracted ${documentText.length} characters from ${req.file.originalname}`);

    const startTime = Date.now();

    // 3つのAIで並列分析
    const [earnings, risks, summary] = await Promise.all([
      cohereClient.chat({
        model: "command-r-plus-08-2024",
        messages: [{ role: "user", content: `Extract financial metrics from earnings report for ${symbol}. Revenue, net income, EPS, margins. Report: ${documentText.substring(0, 2000)}` }],
        maxTokens: 500,
      }),
      cohereClient.chat({
        model: "command-r-plus-08-2024",
        messages: [{ role: "user", content: `List top 5 risks for ${symbol}. Report: ${documentText.substring(0, 2000)}` }],
        maxTokens: 500,
      }),
      cohereClient.chat({
        model: "command-r-plus-08-2024",
        messages: [{ role: "user", content: `Summarize ${symbol} earnings in 3 key points. Report: ${documentText.substring(0, 2000)}` }],
        maxTokens: 400,
      }),
    ]);

    const duration = Date.now() - startTime;

    // レスポンス生成
    const analysisResult = {
      success: true,
      symbol,
      filename: req.file.originalname,
      filesize: req.file.size,
      analysis: {
        financial_metrics: earnings.message.content[0].text,
        risk_assessment: risks.message.content[0].text,
        executive_summary: summary.message.content[0].text,
      },
      processing: {
        duration_ms: duration,
        extracted_chars: documentText.length,
        ai_model: "command-r-plus-08-2024",
      },
      timestamp: new Date().toISOString(),
    };

    res.json(analysisResult);
  } catch (error) {
    console.error("PDF analysis error:", error);
    res.status(500).json({ error: error.message });
  }
});

