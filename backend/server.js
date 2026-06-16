/**
 * ============================================================
 * 2단계: 메시지 송수신 + 브로드캐스트 서버
 * ============================================================
 *
 * [핵심 설계: 왜 서버가 브로드캐스트를 담당하나?]
 *
 * WebSocket은 서버-클라이언트 1:1 연결입니다.
 * Client A는 Client B의 소켓 주소를 모릅니다.
 * 따라서 "A → Server → 전체 브로드캐스트" 구조가 필수입니다.
 *
 * wss.clients = 현재 연결된 모든 클라이언트의 Set
 * ws.readyState === WebSocket.OPEN = 현재 열려있는 연결만 필터링
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: wss.clients.size }));
    return;
  }
  res.writeHead(200);
  res.end('WebSocket Chat Server\n');
});

const wss = new WebSocketServer({ server });

// ──────────────────────────────────────────────────────────
// 브로드캐스트 헬퍼 함수
//
// [설계 이유]
// 이 함수를 분리하는 이유:
// 1. 재사용성: 여러 이벤트에서 동일한 로직 반복 방지
// 2. 명확성: "모두에게 전송" 의도를 함수 이름으로 표현
// 3. 안전성: readyState 체크로 닫힌 연결에 전송 방지
//
// sender: 보낸 사람 (null이면 서버 시스템 메시지 = 전체 전송)
// ──────────────────────────────────────────────────────────
function broadcast(data, sender = null) {
  const message = JSON.stringify(data);

  wss.clients.forEach((client) => {
    // ── readyState 체크가 왜 필요한가? ──────────────────
    // WebSocket 연결은 비동기적으로 닫힐 수 있습니다.
    // 닫힌 소켓에 send()를 호출하면 에러가 발생하므로
    // OPEN 상태인 클라이언트에게만 전송합니다.
    if (client.readyState !== WebSocket.OPEN) return;

    // sender가 있으면 본인 제외 (에코 방지)
    // sender가 null이면 시스템 메시지 → 본인 포함 전체 전송
    if (sender !== null && client === sender) return;

    client.send(message);
  });
}

// ──────────────────────────────────────────────────────────
// 클라이언트 연결 처리
// ──────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log(`🟢 연결 | 현재 접속자: ${wss.clients.size}명`);

  // ── 입장 알림: 새 유저 입장을 기존 유저들에게 알림 ────
  broadcast({
    type: 'SYSTEM',
    message: `새로운 사용자가 입장했습니다. (현재 ${wss.clients.size}명)`,
  }, ws); // sender = ws → 본인에게는 보내지 않음

  // ── 본인에게 환영 메시지 ───────────────────────────────
  ws.send(JSON.stringify({
    type: 'SYSTEM',
    message: '채팅방에 입장했습니다. 👋',
  }));

  // ──────────────────────────────────────────────────────
  // 메시지 수신 → 브로드캐스트
  // ──────────────────────────────────────────────────────
  ws.on('message', (data) => {
    let parsed;

    // ── JSON 파싱 시도 ──────────────────────────────────
    // [왜 JSON인가?]
    // 단순 문자열: "안녕하세요"
    //   → 메시지 타입, 발신자, 시간 등 메타데이터 전달 불가
    //
    // JSON 구조: { type, user, message, createdAt }
    //   → 다양한 메시지 타입 처리 가능
    //   → 클라이언트가 UI를 다르게 렌더링 가능
    //   → 확장성 (나중에 파일, 이미지 등 타입 추가 용이)
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      // JSON이 아닌 경우 그냥 텍스트로 처리
      parsed = { type: 'CHAT', message: data.toString(), user: '익명' };
    }

    console.log(`📨 수신: [${parsed.user}] ${parsed.message}`);

    // ── 브로드캐스트: 보낸 사람 포함 전체에게 전송 ──────
    // [설계 결정: 보낸 사람도 받아야 하는 이유]
    // 클라이언트 A가 메시지를 보내면:
    // - A의 화면에 즉시 표시 (낙관적 업데이트) → 서버 응답 불필요
    // - 또는 서버 확인 후 표시 → 신뢰성 높음 (이 프로젝트 방식)
    // 여기서는 서버에서 확인 후 전체(본인 포함) 표시합니다.
    broadcast({
      type: 'CHAT',
      user: parsed.user,
      message: parsed.message,
      createdAt: new Date().toISOString(),
    }, null); // sender = null → 본인 포함 전체
  });

  // ──────────────────────────────────────────────────────
  // 연결 해제 → 퇴장 알림
  // ──────────────────────────────────────────────────────
  ws.on('close', () => {
    console.log(`🔴 해제 | 남은 접속자: ${wss.clients.size}명`);

    // 퇴장 알림: 연결이 이미 끊어졌으므로 sender 없이 전체 전송
    broadcast({
      type: 'SYSTEM',
      message: `사용자가 퇴장했습니다. (현재 ${wss.clients.size}명)`,
    }, null);
  });

  ws.on('error', (err) => {
    console.error(`❌ 에러: ${err.message}`);
  });
});

server.listen(8080, () => {
  console.log('✅ 채팅 서버 시작: ws://localhost:8080');
});
