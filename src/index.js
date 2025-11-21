import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "healthy", version: "4.0.0" });
});

app.post("/api/analyze", (req, res) => {
  const { symbol } = req.body;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol" });
  }
  res.json({
    symbol,
    company: "Apple Inc.",
    consensus: { recommendation: "BUY" }
  });
});

app.listen(PORT, () => {
  console.log("Server on port " + PORT);
});

export default app;
