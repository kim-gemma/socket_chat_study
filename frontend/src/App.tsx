/**
 * ============================================================
 * 2단계: 메시지 송수신 + 채팅 UI
 * ============================================================
 */

import { useState, useEffect, useRef } from 'react';
import { getWsUrl } from './config';
import type { ChatMessage, MessageItem } from './types/message';
import './App.css';

// ──────────────────────────────────────────────────────────
// 고유 ID 생성 헬퍼
// crypto.randomUUID()는 최신 브라우저에서 지원
// ──────────────────────────────────────────────────────────
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export default function App() {

  // ──────────────────────────────────────────────────────
  // Ref: 렌더링과 무관한 "사이드이펙트 자원"
  // ──────────────────────────────────────────────────────
  const wsRef        = useRef<WebSocket | null>(null);

  // ── 메시지 목록 스크롤 자동 이동용 ref ──────────────────
  // [왜 ref인가?]
  // DOM 요소를 직접 조작(scrollIntoView)하는 것은 사이드이펙트.
  // useState로 관리할 필요 없이 ref로 DOM 노드만 참조하면 충분.
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ──────────────────────────────────────────────────────
  // State: UI에 직접 반영되는 값들
  // ──────────────────────────────────────────────────────
  const [status,     setStatus]     = useState<ConnectionStatus>('connecting');
  const [messages,   setMessages]   = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [userName,   setUserName]   = useState('');
  const [nameInput,  setNameInput]  = useState('');
  const [isJoined,   setIsJoined]   = useState(false);

  // ──────────────────────────────────────────────────────
  // 메시지 추가 헬퍼
  // ──────────────────────────────────────────────────────
  const addMessage = (msg: ChatMessage, isMine = false) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: genId(), isMine },
    ]);
  };

  // ──────────────────────────────────────────────────────
  // 새 메시지 도착 시 자동 스크롤
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); // messages가 바뀔 때마다 실행

  // ──────────────────────────────────────────────────────
  // WebSocket 연결 (입장 후에만)
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    // 이름을 입력하기 전에는 연결하지 않음
    if (!isJoined) return;

    setStatus('connecting');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    // ── onmessage: 핵심 수신 로직 ─────────────────────
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: ChatMessage = JSON.parse(event.data);

        // [isMine 판별 로직]
        // 서버가 브로드캐스트하면 보낸 사람도 받습니다.
        // user 필드가 현재 사용자 이름과 같으면 내 메시지로 표시.
        const isMine = data.type === 'CHAT' && data.user === userName;
        addMessage(data, isMine);

      } catch {
        addMessage({ type: 'SYSTEM', message: event.data }, false);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('error');
    };

    // ── cleanup ───────────────────────────────────────
    return () => {
      ws.close(1000, '컴포넌트 언마운트');
      wsRef.current = null;
    };
  }, [isJoined, userName]); // isJoined가 true로 바뀔 때 연결 시작

  // ──────────────────────────────────────────────────────
  // 메시지 전송 함수
  //
  // [설계 포인트: ws.send()는 언제 호출해야 하는가?]
  // readyState가 OPEN(1)일 때만 send() 가능.
  // CONNECTING(0) 상태에서 호출하면 에러 발생.
  // 따라서 wsRef.current?.readyState === WebSocket.OPEN 체크 필수.
  // ──────────────────────────────────────────────────────
  const sendMessage = () => {
    const ws = wsRef.current;
    const text = inputValue.trim();

    // ── 전송 전 유효성 검사 ───────────────────────────
    if (!text) return;                             // 빈 메시지 방지
    if (!ws || ws.readyState !== WebSocket.OPEN) { // 연결 상태 확인
      addMessage({ type: 'SYSTEM', message: '⚠️ 서버와 연결되지 않았습니다.' });
      return;
    }

    // ── JSON으로 직렬화해서 전송 ──────────────────────
    ws.send(JSON.stringify({
      type: 'CHAT',
      user: userName,
      message: text,
    }));

    setInputValue(''); // 입력창 초기화
  };

  // ──────────────────────────────────────────────────────
  // Enter 키 전송
  //
  // [설계 포인트: Shift+Enter는 줄바꿈으로 처리]
  // 채팅 앱 UX 관례: Enter = 전송, Shift+Enter = 줄바꿈
  // ──────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // 기본 동작(폼 제출) 방지
      sendMessage();
    }
  };

  // ──────────────────────────────────────────────────────
  // 입장 처리
  // ──────────────────────────────────────────────────────
  const handleJoin = () => {
    const name = nameInput.trim();
    if (!name) return;
    setUserName(name);
    setIsJoined(true);
  };

  // ──────────────────────────────────────────────────────
  // 상태별 색상
  // ──────────────────────────────────────────────────────
  const statusColor: Record<ConnectionStatus, string> = {
    connecting:   '#f59e0b',
    connected:    '#10b981',
    disconnected: '#6b7280',
    error:        '#ef4444',
  };
  const statusLabel: Record<ConnectionStatus, string> = {
    connecting:   '🟡 연결 중...',
    connected:    '🟢 연결됨',
    disconnected: '⚫ 연결 끊김',
    error:        '🔴 에러',
  };

  // ──────────────────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────────────────

  // ── 입장 전: 이름 입력 화면 ──────────────────────────
  if (!isJoined) {
    return (
      <div style={styles.joinWrapper}>
        <div style={styles.joinBox}>
          <h2 style={{ marginBottom: 8 }}>💬 채팅방 입장</h2>
          <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 14 }}>
            사용할 닉네임을 입력하세요
          </p>
          <input
            style={styles.joinInput}
            type="text"
            placeholder="닉네임 입력..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          <button
            style={{
              ...styles.sendBtn,
              opacity: nameInput.trim() ? 1 : 0.5,
              cursor: nameInput.trim() ? 'pointer' : 'not-allowed',
            }}
            onClick={handleJoin}
            disabled={!nameInput.trim()}
          >
            입장하기
          </button>
        </div>
      </div>
    );
  }

  // ── 입장 후: 채팅 화면 ───────────────────────────────
  return (
    <div style={styles.wrapper}>

      {/* ── 헤더 ───────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <strong>WebSocket 채팅</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            👤 {userName}
          </span>
          <span style={{
            fontSize: 12,
            color: statusColor[status],
            fontWeight: 600,
          }}>
            {statusLabel[status]}
          </span>
        </div>
      </header>

      {/* ── 메시지 목록 ────────────────────────────────── */}
      <main style={styles.messageList}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            아직 메시지가 없습니다. 첫 메시지를 보내보세요! 👋
          </div>
        )}

        {messages.map((msg) => {
          // ── 시스템 메시지 ─────────────────────────────
          if (msg.type === 'SYSTEM') {
            return (
              <div key={msg.id} style={styles.systemMsg}>
                {msg.message}
              </div>
            );
          }

          // ── 채팅 메시지: 내 것 / 상대방 것 구분 ─────────
          // isMine: true → 오른쪽 정렬 (파란색)
          // isMine: false → 왼쪽 정렬 (회색)
          return (
            <div
              key={msg.id}
              style={{
                ...styles.msgRow,
                flexDirection: msg.isMine ? 'row-reverse' : 'row',
              }}
            >
              {/* 아바타 */}
              <div style={{
                ...styles.avatar,
                background: msg.isMine ? '#3b82f6' : '#6b7280',
              }}>
                {msg.user?.[0]?.toUpperCase() ?? '?'}
              </div>

              {/* 말풍선 */}
              <div style={{ maxWidth: '65%' }}>
                {!msg.isMine && (
                  <div style={styles.senderName}>{msg.user}</div>
                )}
                <div style={{
                  ...styles.bubble,
                  background: msg.isMine ? '#3b82f6' : '#f3f4f6',
                  color:      msg.isMine ? '#ffffff' : '#111827',
                  borderRadius: msg.isMine
                    ? '18px 4px 18px 18px'
                    : '4px 18px 18px 18px',
                }}>
                  {msg.message}
                </div>
                {msg.createdAt && (
                  <div style={{
                    ...styles.timestamp,
                    textAlign: msg.isMine ? 'right' : 'left',
                  }}>
                    {new Date(msg.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* 자동 스크롤 앵커 */}
        <div ref={messagesEndRef} />
      </main>

      {/* ── 입력 영역 ───────────────────────────────────── */}
      <footer style={styles.inputArea}>
        <input
          style={styles.input}
          type="text"
          placeholder={
            status === 'connected'
              ? '메시지를 입력하세요... (Enter로 전송)'
              : '서버 연결 중...'
          }
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={status !== 'connected'}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: (inputValue.trim() && status === 'connected') ? 1 : 0.5,
            cursor:  (inputValue.trim() && status === 'connected') ? 'pointer' : 'not-allowed',
          }}
          onClick={sendMessage}
          disabled={!inputValue.trim() || status !== 'connected'}
        >
          전송 ↑
        </button>
      </footer>

    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 스타일 (인라인 스타일 객체)
// ──────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    maxWidth: 680,
    margin: '0 auto',
    background: '#ffffff',
    boxShadow: '0 0 30px rgba(0,0,0,0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: '#f9fafb',
  },
  emptyState: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 60,
    fontSize: 14,
  },
  systemMsg: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    background: '#f3f4f6',
    borderRadius: 20,
    padding: '4px 14px',
    alignSelf: 'center',
  },
  msgRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  senderName: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 3,
    paddingLeft: 4,
  },
  bubble: {
    padding: '10px 14px',
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 3,
    paddingLeft: 4,
    paddingRight: 4,
  },
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  input: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 24,
    border: '1px solid #e5e7eb',
    fontSize: 14,
    outline: 'none',
    background: '#f9fafb',
  },
  sendBtn: {
    padding: '10px 20px',
    background: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 24,
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  joinWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100dvh',
    background: '#f9fafb',
  },
  joinBox: {
    background: '#ffffff',
    borderRadius: 16,
    padding: 32,
    width: 320,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  joinInput: {
    padding: '10px 16px',
    borderRadius: 24,
    border: '1px solid #e5e7eb',
    fontSize: 14,
    outline: 'none',
  },
};
