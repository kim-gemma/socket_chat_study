import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * StrictMode 제거 이유 (학습 목적):
 *
 * StrictMode는 개발 환경에서 useEffect를 의도적으로 2번 실행합니다.
 * → cleanup 함수 검증 목적
 * → 실제 연결/해제가 2번 일어나므로 학습 시 혼란을 줄 수 있음
 *
 * 실무에서는 StrictMode를 유지하는 것이 좋습니다.
 * cleanup이 올바르게 작동한다면 StrictMode에서도 문제없어야 합니다.
 */
createRoot(document.getElementById('root')!).render(
  <App />
)
