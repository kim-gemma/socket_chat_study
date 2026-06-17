/**
 * ============================================================
 * useWebSocket - 커스텀 Hook
 * ============================================================
 *
 * [Hook으로 분리하는 3가지 이유]
 *
 * 1. 관심사 분리 (Separation of Concerns)
 *    "어떻게 연결하고 통신하는가" 와 "어떻게 보여주는가" 를 분리.
 *    변경이 발생해도 서로 영향을 주지 않음.
 *
 * 2. 재사용성
 *    다른 컴포넌트에서 WebSocket이 필요하면
 *    import { useWebSocket } from './hooks/useWebSocket' 한 줄로 해결.
 *
 * 3. 테스트 용이성
 *    Hook은 React 컴포넌트 없이 renderHook()으로 단독 테스트 가능.
 *    UI 테스트와 로직 테스트를 분리할 수 있음.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage, MessageItem } from '../types/message';

// ──────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Hook이 반환하는 인터페이스
// → Chat.tsx는 이 인터페이스만 알면 됨. 내부 구현은 몰라도 됨.
export interface UseWebSocketReturn {
  messages:    MessageItem[];
  status:      ConnectionStatus;
  sendMessage: (text: string) => void;
  clearMessages: () => void;
}

// ──────────────────────────────────────────────────────────
// 고유 ID 생성 헬퍼
// ──────────────────────────────────────────────────────────
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ──────────────────────────────────────────────────────────
// useWebSocket Hook
//
// 매개변수:
//   url      - WebSocket 서버 주소
//   userName - 현재 사용자 이름 (isMine 판별용)
//   enabled  - 연결 활성화 여부 (false면 연결 안 함)
// ──────────────────────────────────────────────────────────
export function useWebSocket(
  url: string,
  userName: string,
  enabled: boolean,
): UseWebSocketReturn {

  // ──────────────────────────────────────────────────────
  // useRef: WebSocket 인스턴스 저장
  //
  // [핵심 질문] 왜 useState가 아니라 useRef인가?
  //
  // WebSocket 객체는 두 가지 조건을 만족해야 합니다:
  //
  //   1. 컴포넌트가 리렌더링돼도 같은 인스턴스를 유지해야 함
  //      → useState는 값이 바뀌면 리렌더링 → 새 값으로 교체
  //      → useRef는 .current만 바꾸므로 리렌더링 없음
  //
  //   2. 리렌더링을 유발하면 안 됨
  //      → WebSocket 자체는 UI와 무관한 "연결 자원"
  //      → UI에 영향을 주는 건 messages, status 같은 파생 상태
  //
  // [재렌더링과 WebSocket 연결의 관계]
  //
  //   만약 wsRef를 useState로 바꾸면:
  //   setSocket(ws) → 리렌더링 → useEffect 재실행 여부 검사
  //   → socket이 의존성 배열에 있다면 연결 재생성 → 무한 루프 위험!
  //
  //   useRef는 .current 변경이 리렌더링을 전혀 유발하지 않으므로 안전.
  // ──────────────────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);

  // ──────────────────────────────────────────────────────
  // useState: UI에 반영되어야 하는 파생 상태들
  //
  // 이것들은 변경될 때 컴포넌트가 재렌더링되어야 하므로 useState 사용.
  // ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [status,   setStatus]   = useState<ConnectionStatus>('connecting');

  // ──────────────────────────────────────────────────────
  // useEffect: WebSocket 연결 생명주기 관리
  //
  // [의존성 배열 [url, userName, enabled] 설명]
  //
  //   빈 배열 [] 사용 시:
  //   → 마운트 시 1회만 실행 → url, userName이 바뀌어도 재연결 안 됨
  //   → 하드코딩된 url에서는 괜찮지만, 동적 url에서는 문제
  //
  //   [url, userName, enabled] 사용 시:
  //   → 세 값 중 하나라도 바뀌면 cleanup → 새 연결
  //   → enabled가 false → true로 바뀔 때 연결 시작
  //   → url이 바뀌면 자동으로 새 서버에 재연결
  //
  //   의존성 배열은 "언제 이 effect를 다시 실행할까?"의 선언입니다.
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    // enabled가 false이면 연결하지 않음 (이름 입력 전 등)
    if (!enabled) return;

    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: ChatMessage = JSON.parse(event.data);
        const isMine = data.type === 'CHAT' && data.user === userName;

        setMessages((prev) => [
          ...prev,
          { ...data, id: genId(), isMine },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            type: 'SYSTEM',
            message: event.data,
            isMine: false,
          },
        ]);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('error');
    };

    // ── cleanup 함수 ──────────────────────────────────
    // [cleanup이 실행되는 3가지 시점]
    //
    //   1. 컴포넌트 언마운트 시
    //      → 페이지 이탈, 라우팅 변경
    //
    //   2. 의존성 배열 값이 바뀌어 effect가 재실행되기 직전
    //      → url이 바뀌면: cleanup(이전 연결 종료) → effect(새 연결)
    //
    //   3. React StrictMode 개발 환경
    //      → effect를 2번 실행해 cleanup이 제대로 동작하는지 검증
    //
    // cleanup이 없으면:
    //   → 이전 ws 인스턴스가 닫히지 않고 메모리에 남음 (누수)
    //   → 새 연결 + 이전 연결이 동시에 살아있어 메시지 중복 수신
    // ──────────────────────────────────────────────────
    return () => {
      ws.close(1000, 'cleanup');
      wsRef.current = null;
    };

  }, [url, userName, enabled]); // ← 이 세 값이 바뀔 때만 재연결

  // ──────────────────────────────────────────────────────
  // sendMessage - 메시지 전송 함수
  //
  // [useCallback을 쓰는 이유]
  //
  //   useCallback 없이:
  //   → 매 렌더링마다 sendMessage 함수가 새로 생성됨
  //   → Chat.tsx의 button onClick에 새 함수 참조가 전달됨
  //   → React.memo로 감싼 자식 컴포넌트도 불필요하게 리렌더링
  //
  //   useCallback 사용:
  //   → [wsRef, userName] 값이 바뀌지 않으면 같은 함수 참조 유지
  //   → 자식 컴포넌트 불필요한 리렌더링 방지
  //
  //   현재 규모에서는 성능 차이가 미미하지만,
  //   실무에서는 useCallback을 통해 의도를 명확히 표현하는 것이 좋습니다.
  // ──────────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    const ws = wsRef.current;

    if (!text.trim()) return;

    // readyState 체크: OPEN(1) 상태에서만 send 가능
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[useWebSocket] send 실패: 연결 상태가 OPEN이 아님', ws?.readyState);
      return;
    }

    ws.send(JSON.stringify({
      type: 'CHAT',
      user: userName,
      message: text.trim(),
    }));
  }, [userName]); // wsRef는 ref이므로 의존성 불필요 (항상 최신값)

  // ──────────────────────────────────────────────────────
  // clearMessages - 메시지 목록 초기화
  // ──────────────────────────────────────────────────────
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // ──────────────────────────────────────────────────────
  // 반환값: Chat.tsx가 필요한 것만 노출
  //
  // wsRef 자체는 반환하지 않습니다.
  // → 외부에서 ws 인스턴스를 직접 조작하면 캡슐화가 깨짐
  // → sendMessage()처럼 메서드로만 접근하게 제한
  // ──────────────────────────────────────────────────────
  return {
    messages,
    status,
    sendMessage,
    clearMessages,
  };
}
