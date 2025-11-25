import express from "express";
import dotenv from "dotenv";
import { loadSpecifications } from "../spec-client.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8888;
let specifications = null;

(async () => {
  try {
    specifications = await loadSpecifications();
    console.log('✅ Specifications loaded');
  } catch (e) {
    console.warn('⚠️ Specification error:', e.message);
  }
})();

app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const stockData = {
  "AAPL": { company: "Apple Inc.", recommendation: "BUY" },
  "GOOGL": { company: "Alphabet Inc.", recommendation: "HOLD" },
  "MSFT": { company: "Microsoft Corp.", recommendation: "BUY" },
  "TSLA": { company: "Tesla Inc.", recommendation: "HOLD" },
  "NVDA": { company: "NVIDIA Corp.", recommendation: "BUY" },
  "META": { company: "Meta Platforms", recommendation: "HOLD" },
  "AMZN": { company: "Amazon.com Inc.", recommendation: "BUY" }
};

app.post("/api/analyze", (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: "Missing symbol" });
  const data = stockData[symbol.toUpperCase()] || { 
    company: `${symbol} Inc.`, 
    recommendation: "HOLD"
  };
  res.json({
    symbol,
    company: data.company,
    consensus: { recommendation: data.recommendation },
    spec_context_used: !!specifications
  });
});

app.listen(PORT, () => {
  console.log(`✅ MAGI Analytics Center running on port ${PORT}`);
});

export default app;
