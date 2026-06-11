// 채팅 시스템 E2E 부하 테스트
//
// 흐름: 가상 유저(VU)가 WebSocket으로 접속해 주기적으로 메시지를 전송하고,
//       브로드캐스트로 돌아오는 CONTENT_MESSAGE를 수신해 E2E 레이턴시를 계측한다.
//
// 계측 지표:
//   chat_e2e_latency          전송 → 수신까지 전 구간 지연 (WS → Kafka → DB+Outbox → Debezium → Fanout → WS)
//   chat_msgs_sent            전송한 메시지 수
//   chat_msgs_received        수신한 메시지 수 (모든 VU 합산)
//   chat_dup_sends            의도적으로 재전송한 메시지 수 (DUP_RATIO 옵션, 멱등성 검증용)
//   chat_transport_duplicates 같은 messageId가 두 번 도착한 횟수 (전달 구간 중복)
//   chat_logical_duplicates   같은 내용(vu:seq)이 다른 messageId로 도착한 횟수 (중복 "저장" — 멱등성 부재의 증거)
//   chat_ws_errors            WebSocket 오류 수
//
// 환경변수:
//   VUS=30 DURATION_SEC=60 CHANNELS=3 MSG_INTERVAL_MS=2000 DUP_RATIO=0
//   BASE_URL=http://localhost:8080 WS_URL=ws://localhost:8080/ws

import ws from "k6/ws";
import http from "k6/http";
import { check, fail } from "k6";
import { Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const WS_URL = __ENV.WS_URL || "ws://localhost:8080/ws";
const VUS = parseInt(__ENV.VUS || "30", 10);
const DURATION_SEC = parseInt(__ENV.DURATION_SEC || "60", 10);
const CHANNELS = parseInt(__ENV.CHANNELS || "3", 10);
const MSG_INTERVAL_MS = parseInt(__ENV.MSG_INTERVAL_MS || "2000", 10);
const DUP_RATIO = parseFloat(__ENV.DUP_RATIO || "0");
const PASSWORD = "loadtest1234";

const e2eLatency = new Trend("chat_e2e_latency", true);
const msgsSent = new Counter("chat_msgs_sent");
const msgsReceived = new Counter("chat_msgs_received");
const dupSends = new Counter("chat_dup_sends");
const transportDups = new Counter("chat_transport_duplicates");
const logicalDups = new Counter("chat_logical_duplicates");
const wsErrors = new Counter("chat_ws_errors");

export const options = {
  scenarios: {
    chat: {
      executor: "constant-vus",
      vus: VUS,
      duration: `${DURATION_SEC}s`,
      gracefulStop: "10s",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    chat_e2e_latency: ["p(95)<1000", "p(99)<3000"],
    chat_ws_errors: ["count==0"],
  },
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function jsonHeaders(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return { headers: h };
}

// ── setup: 유저 생성/로그인 → 채널 생성 → 멤버 조인 ──────────────────────────
export function setup() {
  const users = [];

  for (let i = 0; i < VUS; i++) {
    const email = `loadtest-${i}@k6.local`;

    // 이미 존재하면 실패해도 무방 (이후 로그인으로 검증)
    http.post(
      `${BASE_URL}/api/auth/signup`,
      JSON.stringify({ email, password: PASSWORD, name: `부하유저${i}`, phone: "010-0000-0000", role: "USER" }),
      jsonHeaders()
    );

    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email, password: PASSWORD }),
      jsonHeaders()
    );
    if (loginRes.status !== 200) {
      fail(`로그인 실패: ${email} status=${loginRes.status} body=${loginRes.body}`);
    }
    const token = loginRes.json("data.accessToken");
    users.push({ email, token });
  }

  // 채널 생성 (매 실행마다 새 채널 — 멤버 중복 조인 방지)
  const channelIds = [];
  for (let c = 0; c < CHANNELS; c++) {
    const res = http.post(
      `${BASE_URL}/api/channels`,
      JSON.stringify({ title: `loadtest-${c}-${uuid().slice(0, 8)}` }),
      jsonHeaders(users[0].token)
    );
    if (res.status !== 201) {
      fail(`채널 생성 실패: status=${res.status} body=${res.body}`);
    }
    channelIds.push(res.json("data.channelId"));
  }

  // 유저 i → 채널 i % CHANNELS 조인
  users.forEach((u, i) => {
    u.channelId = channelIds[i % CHANNELS];
    const res = http.post(`${BASE_URL}/api/channels/${u.channelId}/members`, null, jsonHeaders(u.token));
    if (res.status !== 201) {
      fail(`채널 조인 실패: ${u.email} → channel=${u.channelId} status=${res.status}`);
    }
  });

  console.log(`[setup] users=${VUS}, channels=${channelIds.join(",")}, membersPerChannel≈${Math.ceil(VUS / CHANNELS)}`);
  return { users };
}

// ── 시나리오 본문: VU당 WebSocket 1개를 DURATION 동안 유지 ────────────────────
export default function (data) {
  const me = data.users[(__VU - 1) % data.users.length];
  const seenMessageIds = {};
  const seenContentKeys = {};
  let seq = 0;

  const res = ws.connect(`${WS_URL}?token=${me.token}`, {}, (socket) => {
    socket.on("open", () => {
      // 서버 TTL(90s)보다 짧은 주기로 하트비트
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: "HEARTBEAT", payload: {} }));
      }, 25_000);

      // 주기적 메시지 전송 (VU별 지터로 동시 폭주 방지)
      socket.setInterval(() => {
        const clientMessageId = uuid();
        const content = JSON.stringify({ k6: 1, vu: __VU, seq: seq++, sentAt: Date.now() });
        const frame = JSON.stringify({
          type: "SEND_MESSAGE",
          payload: { channelId: me.channelId, content, clientMessageId },
        });
        socket.send(frame);
        msgsSent.add(1);

        // 네트워크 재시도 시뮬레이션: 동일 clientMessageId로 즉시 재전송
        // → 멱등성이 없으면 chat_logical_duplicates 가 올라간다
        if (DUP_RATIO > 0 && Math.random() < DUP_RATIO) {
          socket.send(frame);
          dupSends.add(1);
        }
      }, MSG_INTERVAL_MS + Math.floor(Math.random() * 500));

      // 테스트 종료 직전에 연결 정리
      socket.setTimeout(() => socket.close(), DURATION_SEC * 1000 - 2000);
    });

    socket.on("message", (raw) => {
      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch {
        return;
      }
      if (envelope.type !== "CONTENT_MESSAGE") return;

      const m = envelope.payload;
      msgsReceived.add(1);

      // 전달 구간 중복: 같은 messageId가 두 번 도착
      if (seenMessageIds[m.messageId]) {
        transportDups.add(1);
      } else {
        seenMessageIds[m.messageId] = true;
      }

      let body;
      try {
        body = JSON.parse(m.content);
      } catch {
        return;
      }
      if (!body || body.k6 !== 1) return;

      // 저장 구간 중복: 같은 내용(vu:seq)이 다른 messageId로 도착 → 중복 저장된 것
      const contentKey = `${body.vu}:${body.seq}`;
      if (seenContentKeys[contentKey]) {
        logicalDups.add(1);
      } else {
        seenContentKeys[contentKey] = true;
      }

      e2eLatency.add(Date.now() - body.sentAt);
    });

    socket.on("error", (e) => {
      wsErrors.add(1);
      console.error(`[VU ${__VU}] ws error: ${e.error()}`);
    });
  });

  check(res, { "WebSocket 핸드셰이크 101": (r) => r && r.status === 101 });
}

// ── 요약: 전달률/중복까지 계산해 출력 ────────────────────────────────────────
export function handleSummary(data) {
  const count = (name) => (data.metrics[name] ? data.metrics[name].values.count : 0);
  const trend = data.metrics["chat_e2e_latency"] ? data.metrics["chat_e2e_latency"].values : {};

  const sent = count("chat_msgs_sent");
  const received = count("chat_msgs_received");
  const membersPerChannel = VUS / CHANNELS;
  const expected = Math.round(sent * membersPerChannel); // 발신자 본인도 echo 수신
  const deliveryRatio = expected > 0 ? ((received / expected) * 100).toFixed(2) : "N/A";
  const fmt = (v) => (v === undefined ? "N/A" : `${v.toFixed(1)}ms`);

  const report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 채팅 부하 테스트 결과  (VUs=${VUS}, ${DURATION_SEC}s, 채널 ${CHANNELS}개, 채널당 ~${Math.round(membersPerChannel)}명)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 E2E 레이턴시 (전송→수신 전 구간)
   avg=${fmt(trend.avg)}  med=${fmt(trend.med)}  p90=${fmt(trend["p(90)"])}  p95=${fmt(trend["p(95)"])}  p99=${fmt(trend["p(99)"])}  max=${fmt(trend.max)}

 전달 (Delivery)
   전송: ${sent}건  /  기대 수신: ${expected}건  /  실제 수신: ${received}건
   전달률: ${deliveryRatio}%   (테스트 종료 시점 in-flight 메시지만큼 100% 미만일 수 있음)

 중복 (Duplication)
   의도적 재전송:        ${count("chat_dup_sends")}건  (DUP_RATIO=${DUP_RATIO})
   중복 저장(logical):   ${count("chat_logical_duplicates")}건  ← 멱등성 적용 시 0이어야 함
   중복 전달(transport): ${count("chat_transport_duplicates")}건

 오류
   WebSocket 오류: ${count("chat_ws_errors")}건
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return {
    stdout: report,
    "load-test/results/last-summary.json": JSON.stringify(data, null, 2),
  };
}
