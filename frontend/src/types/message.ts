/**
 * ============================================================
 * 메시지 타입 정의
 * ============================================================
 *
 * [왜 문자열 대신 JSON 타입 메시지를 사용하는가?]
 *
 * ❌ 단순 문자열 방식:
 *   ws.send("안녕하세요")
 *   → 보낸 사람이 누구인지 모름
 *   → 채팅인지 시스템 알림인지 구분 불가
 *   → 타임스탬프, 읽음 여부 등 메타데이터 추가 불가
 *   → 클라이언트 UI가 모든 메시지를 동일하게 렌더링
 *
 * ✅ JSON 타입 방식:
 *   ws.send(JSON.stringify({ type: "CHAT", user: "Kim", message: "안녕" }))
 *   → type 필드로 메시지 종류 구분
 *   → 컴포넌트가 type에 따라 다른 UI 렌더링 가능
 *   → 나중에 TYPING, READ, IMAGE 등 타입 쉽게 추가
 *   → 서버/클라이언트 간 명확한 인터페이스 계약
 */

// ── 메시지 타입 유니온 ──────────────────────────────────────
export type MessageType = 'CHAT' | 'SYSTEM';

// ── 서버에서 받는 메시지 구조 ────────────────────────────────
export interface ChatMessage {
  type: MessageType;
  user?: string;       // CHAT 타입일 때만 존재
  message: string;
  createdAt?: string;  // 서버가 추가하는 타임스탬프
}

// ── 클라이언트 내부 상태용 (UI 렌더링용) ─────────────────────
// id를 추가해 React key prop으로 활용
export interface MessageItem extends ChatMessage {
  id: string;         // 고유 식별자 (Date.now() + Math.random())
  isMine: boolean;    // 내가 보낸 메시지 여부 → UI 좌/우 배치 결정
}
