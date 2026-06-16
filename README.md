# WebSocket 실시간 채팅 앱 학습 프로젝트

WebSocket을 실무 수준으로 이해하기 위한 단계별 학습 프로젝트입니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + ws 라이브러리 |
| 상태 관리 | useState, useEffect, useRef |
| 통신 | WebSocket API |

## 프로젝트 구조

```
ws-chat/
├── backend/
│   └── server.js          # Node.js WebSocket 서버 (포트 8080)
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # 메인 컴포넌트
│   │   ├── config.ts      # WS URL 환경별 설정
│   │   └── main.tsx
│   ├── vite.config.ts     # Vite + WS 프록시 설정
│   └── index.html
└── ecosystem.config.cjs   # PM2 프로세스 관리
```

## 학습 단계

- [x] **1단계** - 기본 WebSocket 연결 (useRef, useEffect, 4대 이벤트)
- [ ] **2단계** - 메시지 송수신 + 브로드캐스트
- [ ] **3단계** - 커스텀 Hook 분리 (useWebSocket)
- [ ] **4단계** - 실무 개선 (재연결, 상태관리, JSON 메시지 타입)
- [ ] **5단계** - 면접 대비 Q&A

## 실행 방법

```bash
# 의존성 설치
cd backend && npm install
cd ../frontend && npm install

# PM2로 전체 실행
cd .. && pm2 start ecosystem.config.cjs

# 개별 실행
node backend/server.js       # 백엔드 (포트 8080)
cd frontend && npm run dev   # 프론트엔드 (포트 3000)
```

## 핵심 학습 포인트

### useRef vs useState

```typescript
// ❌ 나쁜 예: 리렌더링 유발 → WS 재생성 위험
const [socket, setSocket] = useState(null);

// ✅ 좋은 예: 리렌더링 없이 참조 유지
const wsRef = useRef(null);
```

### WebSocket 생명주기

```
new WebSocket(url)  →  onopen  →  onmessage (반복)  →  onclose
                                                ↑
                                             onerror (→ onclose 실행됨)
```

### Vite 프록시 설정

```
Browser → wss://host:3000/ws → Vite Proxy → ws://localhost:8080
```
