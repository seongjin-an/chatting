#!/usr/bin/env bash
# 채팅 부하 테스트 실행 래퍼
#
# 사용법:
#   ./load-test/run.sh smoke      # 5 VU / 30s  — 동작 확인용
#   ./load-test/run.sh baseline   # 30 VU / 60s — 기준 측정
#   ./load-test/run.sh dedup      # 30 VU / 60s + 20% 재전송 — 멱등성 검증
#   ./load-test/run.sh stress     # 100 VU / 120s — 한계 탐색
#
# 추가 환경변수로 개별 값 오버라이드 가능:
#   VUS=50 DURATION_SEC=90 ./load-test/run.sh baseline
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRESET="${1:-smoke}"

case "$PRESET" in
  smoke)    DEFAULT_VUS=5;   DEFAULT_DURATION=30;  DEFAULT_CHANNELS=1; DEFAULT_DUP=0 ;;
  baseline) DEFAULT_VUS=30;  DEFAULT_DURATION=60;  DEFAULT_CHANNELS=3; DEFAULT_DUP=0 ;;
  dedup)    DEFAULT_VUS=30;  DEFAULT_DURATION=60;  DEFAULT_CHANNELS=3; DEFAULT_DUP=0.2 ;;
  stress)   DEFAULT_VUS=100; DEFAULT_DURATION=120; DEFAULT_CHANNELS=10; DEFAULT_DUP=0 ;;
  *) echo "unknown preset: $PRESET (smoke|baseline|dedup|stress)"; exit 1 ;;
esac

export VUS="${VUS:-$DEFAULT_VUS}"
export DURATION_SEC="${DURATION_SEC:-$DEFAULT_DURATION}"
export CHANNELS="${CHANNELS:-$DEFAULT_CHANNELS}"
export DUP_RATIO="${DUP_RATIO:-$DEFAULT_DUP}"
export MSG_INTERVAL_MS="${MSG_INTERVAL_MS:-2000}"

mkdir -p "$ROOT/load-test/results"

# Prometheus remote write가 열려 있으면 메트릭을 내보내 Grafana에서 관찰
K6_OUT=()
if curl -sf -o /dev/null "http://localhost:9091/-/ready" 2>/dev/null; then
  export K6_PROMETHEUS_RW_SERVER_URL="http://localhost:9091/api/v1/write"
  export K6_PROMETHEUS_RW_TREND_STATS="p(50),p(95),p(99),avg,max"
  K6_OUT=(-o experimental-prometheus-rw)
  echo "[run] Prometheus 연동 활성화 → Grafana 'Chat Load Test' 대시보드에서 실시간 확인 가능"
else
  echo "[run] Prometheus(9091) 미응답 — 콘솔 요약만 출력합니다"
fi

TESTID="$PRESET-$(date +%Y%m%d-%H%M%S)"
echo "[run] preset=$PRESET testid=$TESTID VUS=$VUS DURATION=${DURATION_SEC}s CHANNELS=$CHANNELS DUP_RATIO=$DUP_RATIO"

cd "$ROOT"
k6 run "${K6_OUT[@]}" --tag "testid=$TESTID" load-test/chat-load.js
