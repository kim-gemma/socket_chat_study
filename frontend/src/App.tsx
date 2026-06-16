/**
 * ============================================================
 * 1단계: 기본 WebSocket 연결 - App.tsx
 * ============================================================
 *
 * 이 파일은 WebSocket의 4가지 핵심 이벤트를 직접 다루며
 * React 생명주기와 WebSocket 생명주기를 어떻게 맞추는지 보여줍니다.
 */

import { useState, useEffect, useRef } from 'react';
import './App.css';
import { getWsUrl } from './config';

// ──────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function App() {
  // ──────────────────────────────────────────────────────
  // useRef vs useState - 왜 WebSocket을 useRef에 저장하나?
  // ──────────────────────────────────────────────────────
  //
  // ❌ 안 좋은 예:
  //   const [socket, setSocket] = useState<WebSocket | null>(null);
  //
  //   문제점:
  //   1. setState → 리렌더링 발생
  //   2. 리렌더링 → useEffect 재실행 가능성
  //   3. useEffect 재실행 → 새 WebSocket 생성 → 이전 연결 누수!
  //
  // ✅ 올바른 예:
  //   const wsRef = useRef<WebSocket | null>(null);
  //
  //   이유:
  //   1. ref 변경은 리렌더링을 유발하지 않음
  //   2. WebSocket은 "UI에 영향을 주는 상태"가 아닌 "사이드이펙트 자원"
  //   3. 컴포넌트 생명주기 동안 동일한 참조를 유지해야 함
  //
  const wsRef = useRef<WebSocket | null>(null);

  // ──────────────────────────────────────────────────────
  // UI에 직접 표시되는 값만 useState로 관리
  // ──────────────────────────────────────────────────────
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [logs, setLogs] = useState<string[]>([]);

  // 로그 추가 헬퍼 함수
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${message}`]);
  };

  // ──────────────────────────────────────────────────────
  // useEffect - WebSocket 연결의 생명주기 관리
  // ──────────────────────────────────────────────────────
  //
  // 의존성 배열 []의 의미:
  //   - 빈 배열 = "마운트 시 1회만 실행"
  //   - WebSocket은 앱 시작 시 1번만 연결하면 충분
  //   - 의존성을 추가하면 해당 값이 바뀔 때마다 연결이 재생성됨 (위험!)
  //
  useEffect(() => {
    // ── STEP 1: WebSocket 객체 생성 ───────────────────
    //
    // new WebSocket(url) 실행 순간:
    //   1. TCP 3-way handshake 시작
    //   2. HTTP Upgrade 요청 전송 (101 Switching Protocols)
    //   3. 서버 승인 후 WebSocket 프로토콜로 전환
    //   → 이 과정이 비동기로 처리되기 때문에 즉시 연결이 완료되지 않음
    //
    addLog('🔄 WebSocket 연결 시도 중...');
    setStatus('connecting');

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws; // ref에 저장 (리렌더링 없음)

    // ── STEP 2: onopen - 연결 성공 ────────────────────
    //
    // TCP 연결 + HTTP Upgrade가 완료된 후 실행
    // readyState === 1 (OPEN) 상태
    //
    ws.onopen = () => {
      addLog('✅ WebSocket 연결 성공! (readyState: OPEN)');
      setStatus('connected');
    };

    // ── STEP 3: onmessage - 메시지 수신 ──────────────
    //
    // 서버에서 데이터가 도착할 때마다 실행
    // event.data는 string | Blob | ArrayBuffer 중 하나
    // 텍스트 기반 통신에서는 항상 string
    //
    ws.onmessage = (event: MessageEvent) => {
      try {
        // 서버가 JSON을 보내는 경우 파싱 시도
        const parsed = JSON.parse(event.data);
        addLog(`📨 서버로부터 [${parsed.type}]: "${parsed.message}"`);
      } catch {
        // 일반 문자열
        addLog(`📨 서버로부터: "${event.data}"`);
      }
    };

    // ── STEP 4: onclose - 연결 해제 ───────────────────
    //
    // 서버 또는 클라이언트가 연결을 닫을 때 실행
    // code: 종료 코드 (1000=정상, 1001=서버종료, 1006=비정상)
    // wasClean: 정상적인 핸드셰이크로 닫혔는지 여부
    //
    ws.onclose = (event: CloseEvent) => {
      addLog(`🔴 연결 종료 | code: ${event.code} | 정상종료: ${event.wasClean}`);
      setStatus('disconnected');
    };

    // ── STEP 5: onerror - 에러 처리 ───────────────────
    //
    // 중요: onerror 이후에는 반드시 onclose도 실행됨
    // 따라서 에러 시 정리 작업은 onclose에서 하는 것이 좋음
    //
    ws.onerror = (event: Event) => {
      addLog('❌ WebSocket 에러 발생 (onclose가 뒤따라 실행됩니다)');
      setStatus('error');
    };

    // ── STEP 6: Cleanup - 컴포넌트 언마운트 시 ────────
    //
    // 왜 cleanup이 중요한가?
    //   React StrictMode에서는 useEffect가 2번 실행됨 (개발 환경)
    //   cleanup 없으면 → 이전 WebSocket이 열린 채로 새 연결 생성 → 메모리 누수!
    //
    // ws.close()의 의미:
    //   클라이언트가 서버에 "나 연결 끊을게"라는 FIN 신호를 보냄
    //   서버 onclose 이벤트 → 서버도 정리
    //
    return () => {
      addLog('🧹 컴포넌트 언마운트 → WebSocket 연결 해제');
      ws.close(1000, '컴포넌트 언마운트'); // 1000 = 정상 종료 코드
      wsRef.current = null;
    };
  }, []); // ← 빈 배열: 마운트/언마운트 시 1회씩만 실행

  // ──────────────────────────────────────────────────────
  // 수동 연결/해제 버튼 (WebSocket API 직접 확인용)
  // ──────────────────────────────────────────────────────
  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, '사용자가 직접 연결 해제');
    }
  };

  const handleReconnect = () => {
    // 기존 연결 정리
    if (wsRef.current) {
      wsRef.current.close();
    }

    addLog('🔄 재연결 시도...');
    setStatus('connecting');

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => { addLog('✅ 재연결 성공!'); setStatus('connected'); };
    ws.onmessage = (e) => { addLog(`📨 서버로부터: "${e.data}"`); };
    ws.onclose = (e) => { addLog(`🔴 연결 종료 | code: ${e.code}`); setStatus('disconnected'); };
    ws.onerror = () => { addLog('❌ 재연결 에러'); setStatus('error'); };
  };

  // ──────────────────────────────────────────────────────
  // 상태별 스타일
  // ──────────────────────────────────────────────────────
  const statusConfig: Record<ConnectionStatus, { color: string; label: string; dot: string }> = {
    disconnected: { color: '#6b7280', label: '연결 끊김',   dot: '⚫' },
    connecting:   { color: '#f59e0b', label: '연결 중...',  dot: '🟡' },
    connected:    { color: '#10b981', label: '연결됨',      dot: '🟢' },
    error:        { color: '#ef4444', label: '에러',        dot: '🔴' },
  };

  const { color, label, dot } = statusConfig[status];

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 700, margin: '40px auto', padding: '0 20px' }}>

      {/* 헤더 */}
      <h1 style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: 12 }}>
        🔌 WebSocket 학습 - 1단계: 기본 연결
      </h1>

      {/* 연결 상태 카드 */}
      <div style={{
        background: '#f9fafb',
        border: `2px solid ${color}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 18, fontWeight: 'bold', color }}>
          {dot} 연결 상태: {label}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
          readyState 값: 0=CONNECTING | 1=OPEN | 2=CLOSING | 3=CLOSED
        </div>
        <div style={{ fontSize: 14, marginTop: 4, color: '#374151' }}>
          현재 readyState: {wsRef.current?.readyState ?? 'N/A'} ({
            ['CONNECTING','OPEN','CLOSING','CLOSED'][wsRef.current?.readyState ?? 3]
          })
        </div>
      </div>

      {/* 컨트롤 버튼 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={handleDisconnect}
          disabled={status !== 'connected'}
          style={{
            padding: '8px 16px',
            background: status === 'connected' ? '#ef4444' : '#e5e7eb',
            color: status === 'connected' ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: 6,
            cursor: status === 'connected' ? 'pointer' : 'not-allowed',
          }}
        >
          🔌 연결 해제
        </button>
        <button
          onClick={handleReconnect}
          disabled={status === 'connected' || status === 'connecting'}
          style={{
            padding: '8px 16px',
            background: (status === 'disconnected' || status === 'error') ? '#3b82f6' : '#e5e7eb',
            color: (status === 'disconnected' || status === 'error') ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: 6,
            cursor: (status === 'disconnected' || status === 'error') ? 'pointer' : 'not-allowed',
          }}
        >
          🔄 재연결
        </button>
      </div>

      {/* 이벤트 로그 */}
      <div>
        <h3 style={{ marginBottom: 8 }}>📋 이벤트 로그</h3>
        <div style={{
          background: '#111827',
          color: '#d1fae5',
          borderRadius: 8,
          padding: 16,
          height: 300,
          overflowY: 'auto',
          fontSize: 13,
          lineHeight: 1.8,
        }}>
          {logs.length === 0 ? (
            <span style={{ color: '#6b7280' }}>로그 없음...</span>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>

      {/* 학습 노트 */}
      <div style={{
        marginTop: 24,
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: 8,
        padding: 16,
        fontSize: 13,
        lineHeight: 1.8,
      }}>
        <strong>💡 1단계 핵심 개념 정리</strong>
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li><strong>useRef</strong>: WebSocket은 UI와 무관한 자원 → ref로 관리 (리렌더링 방지)</li>
          <li><strong>useEffect(fn, [])</strong>: 마운트 시 연결, 언마운트 시 cleanup으로 해제</li>
          <li><strong>onopen</strong>: TCP+HTTP Upgrade 완료 후 실행 (비동기)</li>
          <li><strong>onmessage</strong>: 서버 데이터 수신 시마다 실행</li>
          <li><strong>onclose</strong>: 연결 종료 시 실행 (onerror 후에도 실행됨)</li>
          <li><strong>ws.close(1000)</strong>: 언마운트 시 반드시 호출 → 메모리 누수 방지</li>
        </ul>
      </div>
    </div>
  );
}
