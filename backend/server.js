/**
 * ============================================================
 * 1단계: 기본 WebSocket 서버 (HTTP + WebSocket 통합)
 * ============================================================
 *
 * [설계 이유]
 * HTTP 서버 위에 WebSocket을 올리는 방식:
 * - 같은 포트(8080)에서 HTTP와 WS 모두 처리
 * - Vite 프록시와 함께 사용 시 안정적
 * - 실무 패턴과 동일 (nginx → Node.js 구조)
 */

const http = require('http');
const { WebSocketServer } = require('ws');

// ──────────────────────────────────────────
// HTTP 서버 생성 (WebSocket의 기반)
// WebSocket은 HTTP Upgrade 요청으로 시작하기 때문에
// HTTP 서버가 먼저 존재해야 함
// ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  // 헬스체크 엔드포인트
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: wss.clients.size }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Server Running\n');
});

// ──────────────────────────────────────────
// WebSocket 서버를 HTTP 서버 위에 생성
// { server } 옵션: 기존 HTTP 서버에 WebSocket 업그레이드 핸들러 붙이기
// ──────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🟢 클라이언트 연결됨 | IP: ${clientIp} | 현재 접속자: ${wss.clients.size}명`);

  ws.on('message', (data) => {
    const message = data.toString();
    console.log(`📨 메시지 수신: ${message}`);
    ws.send(`서버 에코: ${message}`);
  });

  ws.on('close', (code, reason) => {
    console.log(`🔴 연결 해제 | code: ${code} | 남은 접속자: ${wss.clients.size}명`);
  });

  ws.on('error', (error) => {
    console.error(`❌ 에러: ${error.message}`);
  });

  ws.send(JSON.stringify({
    type: 'SYSTEM',
    message: '서버에 연결되었습니다! 👋',
    timestamp: new Date().toISOString()
  }));
});

// ──────────────────────────────────────────
// 서버 시작
// ──────────────────────────────────────────
server.listen(8080, () => {
  console.log('✅ HTTP + WebSocket 서버 시작: http://localhost:8080');
  console.log('   WebSocket: ws://localhost:8080');
  console.log('   Health: http://localhost:8080/health');
});
