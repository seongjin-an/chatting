# 부하 테스트 (k6)

채팅 메시지 전체 경로(WebSocket → Kafka → DB+Outbox → Debezium CDC → Fanout → WebSocket)의
**E2E 레이턴시 / 전달률 / 중복**을 계측한다.

## 사전 조건

- `brew install k6`
- 전체 스택 기동: `./scripts/start.sh` (frontend는 불필요)
- Prometheus 연동(선택)은 `infra/compose.yml`의 `--web.enable-remote-write-receiver` 적용 후
  컨테이너 재생성 필요: `docker compose -f infra/compose.yml up -d prometheus grafana`

## 실행

```bash
./load-test/run.sh smoke      # 5 VU / 30s — 동작 확인
./load-test/run.sh baseline   # 30 VU / 60s / 채널 3개 — 기준 측정
./load-test/run.sh dedup      # baseline + 메시지 20%를 동일 clientMessageId로 재전송
./load-test/run.sh stress     # 100 VU / 120s / 채널 10개

# 개별 값 오버라이드
VUS=50 CHANNELS=5 ./load-test/run.sh baseline
```

테스트 유저(`loadtest-N@k6.local`)는 자동 생성·재사용되고, 채널은 매 실행마다 새로 만든다.

## 지표 해석

| 지표 | 의미 |
|---|---|
| `chat_e2e_latency` | 전송 시각을 메시지 content에 실어 보내고, 수신 시각과의 차로 계산한 전 구간 지연 |
| 전달률 | `수신 / (전송 × 채널당 멤버 수)`. 종료 시점 in-flight 메시지만큼 100%에 약간 못 미칠 수 있음 |
| `chat_logical_duplicates` | 같은 내용(vu:seq)이 **다른 messageId**로 도착 → 중복 **저장**됨. 멱등성(clientMessageId dedup)이 동작하면 0 |
| `chat_transport_duplicates` | 같은 messageId가 두 번 도착 → 전달 구간(at-least-once) 중복. 클라이언트 messageId dedup으로 흡수 |

## 멱등성 before/after 검증

```bash
# after (현재 코드): 중복 저장 0건이어야 함
./load-test/run.sh dedup

# before (멱등성 적용 전 커밋으로 되돌려 비교):
#   chat_logical_duplicates ≈ 재전송 수 × 채널당 멤버 수
```

## Grafana

Prometheus 연동이 켜져 있으면 실행 중 실시간으로 확인 가능:
http://localhost:3001 → Load Test 폴더 → **Chat Load Test (k6)**

결과 JSON은 `load-test/results/last-summary.json`에 저장된다.
