/**
 * WebSocket 서버 URL 설정
 *
 * 핵심 설계 결정:
 * - Vite 개발 서버의 WebSocket 프록시(/ws)를 사용
 * - 이를 통해 프론트(3000포트)와 동일 출처에서 WS 연결 가능
 * - 프로덕션에서는 nginx 같은 리버스 프록시가 동일한 역할을 함
 *
 * 연결 흐름:
 *   Browser → ws://[host]:3000/ws → Vite Proxy → ws://localhost:8080
 */
export function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // hostname:port 포함

  // /ws 경로로 연결 → Vite 프록시가 localhost:8080으로 전달
  return `${protocol}//${host}/ws`;
}
