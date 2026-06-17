/**
 * ============================================================
 * Chat.tsx - 순수 UI 컴포넌트
 * ============================================================
 *
 * [이 컴포넌트의 책임]
 * - useWebSocket Hook에서 받은 데이터를 화면에 렌더링
 * - 사용자 입력을 받아 Hook의 sendMessage() 호출
 * - WebSocket이 어떻게 동작하는지 전혀 알 필요 없음
 *
 * [좋은 컴포넌트 설계의 기준]
 * "이 컴포넌트를 WebSocket 대신 REST API로 바꿔도
 *  이 파일을 수정할 필요가 없어야 한다."
 */

import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import type { ConnectionStatus, UseWebSocketReturn } from '../hooks/useWebSocket';
import type { MessageItem } from '../types/message';

// ──────────────────────────────────────────────────────────
// Props 타입: Hook 반환값 + UI용 추가 데이터
// ──────────────────────────────────────────────────────────
interface ChatProps {
  userName: string;
  wsState:  UseWebSocketReturn; // Hook 반환값을 통째로 받음
}

// ──────────────────────────────────────────────────────────
// 상태 표시 설정
// ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  connecting:   { label: '🟡 연결 중...', color: '#f59e0b' },
  connected:    { label: '🟢 연결됨',    color: '#10b981' },
  disconnected: { label: '⚫ 연결 끊김', color: '#6b7280' },
  error:        { label: '🔴 에러',      color: '#ef4444' },
};

export default function Chat({ userName, wsState }: ChatProps) {
  const { messages, status, sendMessage } = wsState;

  // ──────────────────────────────────────────────────────
  // 로컬 UI 상태: 입력창 텍스트
  // 이건 WebSocket과 무관한 순수 UI 상태이므로 컴포넌트 내부에 위치
  // ──────────────────────────────────────────────────────
  const [inputValue, setInputValue] = useState('');

  // ── 자동 스크롤 ref ────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ──────────────────────────────────────────────────────
  // 전송 핸들러
  // ──────────────────────────────────────────────────────
  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);   // Hook의 sendMessage 호출
    setInputValue('');         // 입력창 초기화
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const { label: statusLabel, color: statusColor } = STATUS_CONFIG[status];
  const canSend = inputValue.trim().length > 0 && status === 'connected';

  // ──────────────────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────────────────
  return (
    <div style={styles.wrapper}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <strong style={{ fontSize: 16 }}>WebSocket 채팅</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>👤 {userName}</span>
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
            {statusLabel}
          </span>
        </div>
      </header>

      {/* ── 메시지 목록 ──────────────────────────────────── */}
      <main style={styles.messageList}>
        {messages.length === 0 && (
          <p style={styles.emptyState}>
            아직 메시지가 없습니다. 첫 메시지를 보내보세요! 👋
          </p>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        <div ref={messagesEndRef} />
      </main>

      {/* ── 입력 영역 ─────────────────────────────────────── */}
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
          autoFocus
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: canSend ? 1 : 0.4,
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          onClick={handleSend}
          disabled={!canSend}
        >
          전송 ↑
        </button>
      </footer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MessageBubble - 메시지 말풍선 서브 컴포넌트
//
// [분리하는 이유]
// Chat.tsx의 map() 내부 JSX가 너무 길어지면 가독성이 떨어짐.
// 메시지 렌더링 로직을 독립 컴포넌트로 분리하면:
// - Chat.tsx의 map 부분이 <MessageBubble key={msg.id} message={msg} /> 한 줄로 정리
// - 말풍선 스타일을 변경할 때 이 컴포넌트만 수정하면 됨
// ──────────────────────────────────────────────────────────
function MessageBubble({ message: msg }: { message: MessageItem }) {
  // 시스템 메시지
  if (msg.type === 'SYSTEM') {
    return (
      <div style={styles.systemMsg}>
        {msg.message}
      </div>
    );
  }

  // 채팅 메시지
  return (
    <div style={{
      ...styles.msgRow,
      flexDirection: msg.isMine ? 'row-reverse' : 'row',
    }}>
      {/* 아바타 */}
      <div style={{
        ...styles.avatar,
        background: msg.isMine ? '#3b82f6' : '#6b7280',
      }}>
        {msg.user?.[0]?.toUpperCase() ?? '?'}
      </div>

      {/* 텍스트 영역 */}
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
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 스타일
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
    transition: 'opacity 0.15s',
  },
};
