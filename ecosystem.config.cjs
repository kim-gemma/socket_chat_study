module.exports = {
  apps: [
    // WebSocket 백엔드 서버 (포트 8080)
    {
      name: 'ws-backend',
      script: '/home/user/ws-chat/backend/server.js',
      interpreter: 'node',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
    },
    // React 프론트엔드 (Vite 개발 서버, 포트 3000)
    {
      name: 'ws-frontend',
      script: 'npx',
      args: 'vite --port 3000 --host 0.0.0.0',
      cwd: '/home/user/ws-chat/frontend',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
