# MAGI Analytics Center v3.1

Multi-AI Investment Analysis System integrated with Google Cloud Platform.

## Overview

MAGI Analytics Center provides real-time stock market analysis by combining:
- **Yahoo Finance API** - Real-time stock data
- **BigQuery** - Time-series data analytics
- **Cloud Storage** - Historical data archival
- **MAGI Core** - 4 AI engines for investment recommendations

### MAGI AI Units (4-Engine System)

| Provider | MAGI Unit | Role | Analysis Type |
|----------|-----------|------|---------------|
| **Grok** (xAI) | Unit-B2 (BALTHASAR) | 創造的・革新的分析 | Creative & Innovative |
| **Gemini** (Google) | Unit-M1 (MELCHIOR) | 論理的・科学的分析 | Logical & Scientific |
| **Claude** (Anthropic) | Unit-C3 (CASPER) | 人間的・感情的分析 | Human & Emotional |
| **Mistral** (Mistral AI) | Unit-R4 (RAPHAEL) | 実践的・戦略的分析 | Practical & Strategic |

## Features

- ✅ Real-time stock quote retrieval (with fallback to mock data)
- ✅ 4 AI engines parallel investment analysis
- ✅ BigQuery external table integration
- ✅ Cloud Storage data persistence
- ✅ RESTful API with 6 endpoints
- ✅ Multi-symbol analysis support
- ✅ Statistical analytics (avg, min, max prices)

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Google Cloud Project with BigQuery and Storage API enabled
- GCP Service Account with appropriate permissions

### Installation

```bash
cd ~/magi-ac
npm install
```

### Environment Setup

Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required API Keys:
- `XAI_API_KEY` - xAI Grok API key
- `GEMINI_API_KEY` - Google Gemini API key
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `MISTRAL_API_KEY` - Mistral AI API key
- `GOOGLE_CLOUD_PROJECT` - GCP Project ID

### Local Development

```bash
# Start server
npm start

# Or with custom port
PORT=9999 npm start
```

### Test the API

```bash
# Health check
curl http://localhost:8888/health | jq .

# Analyze stock
curl -X POST http://localhost:8888/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}' | jq .

# Get latest price
curl http://localhost:8888/api/analytics/latest/AAPL | jq .

# Get price history (30 days)
curl http://localhost:8888/api/analytics/history/AAPL?days=30 | jq .

# Get statistics
curl http://localhost:8888/api/analytics/stats/AAPL | jq .
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/analyze` | Analyze single stock symbol |
| GET | `/api/analytics/latest/:symbol` | Get latest price data |
| GET | `/api/analytics/history/:symbol` | Get price history |
| GET | `/api/analytics/stats/:symbol` | Get statistical analysis |
| POST | `/api/admin/init-bigquery` | Initialize BigQuery tables |

## Architecture

```
Client Request
    ↓
Express Server (Port 8888)
    ↓
┌───────────────┬──────────────┬──────────────┬──────────────┐
↓               ↓              ↓              ↓              ↓
Yahoo Finance   4 AI Engines  BigQuery    Cloud Storage
Collector       (MAGI Core)   Analytics   Persistence
                ├─ Grok (Unit-B2)
                ├─ Gemini (Unit-M1)
                ├─ Claude (Unit-C3)
                └─ Mistral (Unit-R4)
```

## Deployment to Cloud Run

```bash
gcloud run deploy magi-ac \
  --source . \
  --region=asia-northeast1 \
  --platform managed \
  --port=8888 \
  --memory=512Mi \
  --timeout=300
```

## Project Structure

```
magi-ac/
├── src/
│   └── index.js              # Main Express server
├── collectors/
│   ├── yahoo-finance.js      # Yahoo Finance API integration
│   ├── grok.js               # xAI Grok (Unit-B2)
│   ├── gemini.js             # Google Gemini (Unit-M1)
│   ├── claude.js             # Anthropic Claude (Unit-C3)
│   └── mistral.js            # Mistral AI (Unit-R4)
├── bigquery/
│   └── analytics.js          # BigQuery queries and table setup
├── utils/
│   └── storage.js            # Cloud Storage operations
├── package.json              # Dependencies
├── .env.example              # Environment template
└── README.md                 # This file
```

## Cloud Resources

### BigQuery
- Dataset: `magi_ac`
- Table: `financials_raw` (External Table)
- Source: `gs://magi-ac-data/raw/financials/*.json`

### Cloud Storage
- Bucket: `magi-ac-data`
- Path: `raw/financials/{timestamp}-{symbol}.json`

### Cloud Run
- Service: `magi-ac`
- Region: `asia-northeast1`
- Port: 8888
- Memory: 512Mi

## Development Roadmap

### Phase 1: Basic Analytics (Current)
- [x] Single symbol analysis
- [x] Yahoo Finance integration
- [x] BigQuery external tables
- [x] Cloud Storage persistence

### Phase 2: Advanced Features
- [ ] Multi-symbol batch analysis
- [ ] Technical indicators (MA, RSI, MACD)
- [ ] Caching layer (Redis)
- [ ] Rate limiting

### Phase 3: AI Integration
- [ ] MAGI Core connectivity
- [ ] Confidence scoring
- [ ] Portfolio optimization
- [ ] Backtesting engine

### Phase 4: Real-time Processing
- [ ] Cloud Pub/Sub streaming
- [ ] WebSocket updates
- [ ] Price alerts (Slack/Email)
- [ ] Dashboard (Looker Studio)

## Troubleshooting

### Port Already in Use
```bash
fuser -k 8888/tcp
PORT=9999 npm start
```

### Yahoo Finance API Down
The system automatically falls back to mock data when the API is unavailable.

### BigQuery Permission Errors
```bash
gcloud projects add-iam-policy-binding screen-share-459802 \
  --member="serviceAccount:YOUR-SA@..." \
  --role="roles/bigquery.dataEditor"
```

## License

MIT

## Version

3.1.0 - Full implementation with BigQuery, Cloud Storage, and Yahoo Finance integration

---

**Built with ❤️ by MAGI Team**
