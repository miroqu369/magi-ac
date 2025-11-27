#!/bin/bash
# Quick test script for IAA system

BASE_URL="${BASE_URL:-http://localhost:8888}"
PASS=0
FAIL=0

test_endpoint() {
  local name=$1
  local cmd=$2
  
  echo -n "Testing ${name}... "
  if eval ${cmd} > /dev/null 2>&1; then
    echo "✓ PASS"
    ((PASS++))
  else
    echo "✗ FAIL"
    ((FAIL++))
  fi
}

echo "======================================"
echo "   IAA System Test Suite"
echo "   Base URL: ${BASE_URL}"
echo "======================================"
echo ""

test_endpoint "Health Check" \
  "curl -sf ${BASE_URL}/health | jq -e '.status'"

test_endpoint "Basic Analysis" \
  "curl -sf -X POST ${BASE_URL}/api/institutional/analyze -H 'Content-Type: application/json' -d '{\"symbol\":\"AAPL\",\"enableAI\":false,\"saveToDB\":false}' | jq -e '.manipulation_score'"

test_endpoint "Watchlist Get" \
  "curl -sf ${BASE_URL}/api/institutional/watchlist | jq -e '.total >= 0'"

test_endpoint "Watchlist Add" \
  "curl -sf -X POST ${BASE_URL}/api/institutional/watchlist -H 'Content-Type: application/json' -d '{\"symbol\":\"TEST\"}' | jq -e '.success'"

test_endpoint "Active Alerts" \
  "curl -sf ${BASE_URL}/api/institutional/alerts/active | jq -e '.summary'"

test_endpoint "Monitoring Config" \
  "curl -sf ${BASE_URL}/api/institutional/monitoring/config | jq -e '.HIGH_RISK_THRESHOLD'"

test_endpoint "AI Quick Analysis" \
  "curl -sf -X POST ${BASE_URL}/api/institutional/ai-quick -H 'Content-Type: application/json' -d '{\"symbol\":\"AAPL\",\"ai\":\"gemini\"}' | jq -e '.analysis.manipulation_likelihood'"

echo ""
echo "======================================"
echo "   Results"
echo "======================================"
echo "PASS: ${PASS}"
echo "FAIL: ${FAIL}"
echo "Total: $((PASS + FAIL))"
echo ""

if [ ${FAIL} -eq 0 ]; then
  echo "✓ All tests passed!"
  exit 0
else
  echo "✗ Some tests failed"
  exit 1
fi
