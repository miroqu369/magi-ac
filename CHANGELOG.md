# MAGI-AC Swing Analysis

## Recent Updates (2025-11-25)

### New Feature: Swing Trading Analysis Endpoint
- **Endpoint**: `POST /api/swing/analyze`
- **Features**:
  - RSI calculation (simplified)
  - 5-level trend detection
  - Support/Resistance levels
  - Entry/Stop Loss/Take Profit recommendations
  - BUY/SELL/WAIT signals with confidence scores

### Usage Example:
```bash
curl -X POST http://localhost:8888/api/swing/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL"}'
```

### Response Format:
- priceData: Current price, changes, moving averages
- technicalIndicators: RSI, trend, support/resistance
- recommendation: Action, confidence, prices, reasoning

