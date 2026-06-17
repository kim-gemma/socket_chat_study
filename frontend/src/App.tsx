/**
 * ============================================================
 * App.tsx - 최상위 조립 컴포넌트 (3단계)
 * ============================================================
 *
 * [이 파일의 책임]
 * 1. 사용자 이름 입력 (입장 전 화면)
 * 2. useWebSocket Hook 호출 → wsState 생성
 * 3. Chat 컴포넌트에 wsState 전달
 *
 * WebSocket 세부 로직은 useWebSocket이,
 * UI 렌더링은 Chat이 담당하므로
 * App.tsx는 "조립"만 합니다.
 *
 * 비유: App = 감독, Hook = 배우의 대사, Chat = 무대 세트
 */

import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Chat from './components/Chat';
import { getWsUrl } from './config';
import './App.css';

export default function App() {
  // ── 입장 전 상태 ──────────────────────────────────────
  const [nameInput, setNameInput] = useState('');
  const [userName,  setUserName]  = useState('');
  const [isJoined,  setIsJoined]  = useState(false);

  // ──────────────────────────────────────────────────────
  // useWebSocket Hook 호출
  //
  // [핵심 포인트]
  // enabled = isJoined 를 통해 이름 입력 전에는 연결하지 않습니다.
  // Hook 내부에서 if (!enabled) return 으로 처리됩니다.
  //
  // Hook은 항상 조건 없이 호출해야 합니다 (Rules of Hooks).
  // if (isJoined) { useWebSocket(...) } ← 이렇게 쓰면 에러!
  // 대신 enabled 파라미터로 내부 동작을 제어합니다.
  // ──────────────────────────────────────────────────────
  const wsState = useWebSocket(
    getWsUrl(),   // url
    userName,     // 현재 사용자 이름
    isJoined,     // enabled: 입장 후에만 연결
  );

  // ── 입장 처리 ──────────────────────────────────────────
  const handleJoin = () => {
    const name = nameInput.trim();
    if (!name) return;
    setUserName(name);
    setIsJoined(true);
  };

  // ──────────────────────────────────────────────────────
  // 입장 전: 닉네임 입력 화면
  // ──────────────────────────────────────────────────────
  if (!isJoined) {
    return (
      <div style={joinStyles.wrapper}>
        <div style={joinStyles.box}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <h2 style={{ marginBottom: 6, fontSize: 20 }}>채팅방 입장</h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
            사용할 닉네임을 입력하세요
          </p>
          <input
            style={joinStyles.input}
            type="text"
            placeholder="닉네임 입력..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
            maxLength={12}
          />
          <p style={{ fontSize: 11, color: '#d1d5db', textAlign: 'right' }}>
            {nameInput.length} / 12
          </p>
          <button
            style={{
              ...joinStyles.btn,
              opacity: nameInput.trim() ? 1 : 0.45,
              cursor: nameInput.trim() ? 'pointer' : 'not-allowed',
            }}
            onClick={handleJoin}
            disabled={!nameInput.trim()}
          >
            입장하기 →
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────
  // 입장 후: Chat 컴포넌트에 모든 것을 위임
  // App.tsx는 Chat이 어떻게 UI를 그리는지 알 필요 없음
  // ──────────────────────────────────────────────────────
  return (
    <Chat
      userName={userName}
      wsState={wsState}
    />
  );
}

// ── 입장 화면 스타일 ────────────────────────────────────────
const joinStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100dvh',
    background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
  },
  box: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '36px 32px',
    width: 320,
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textAlign: 'center',
  },
  input: {
    padding: '11px 16px',
    borderRadius: 12,
    border: '1.5px solid #e5e7eb',
    fontSize: 15,
    outline: 'none',
    textAlign: 'center',
    letterSpacing: 1,
  },
  btn: {
    marginTop: 6,
    padding: '12px',
    background: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
};
