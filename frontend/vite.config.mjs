import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  return {
    plugins: [react()],
    define: Object.fromEntries(Object.entries(env).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]).concat([
      ['process.env.REACT_APP_API_URL', JSON.stringify(env.REACT_APP_API_URL || '')],
      ['process.env.REACT_APP_APP_NAME', JSON.stringify(env.REACT_APP_APP_NAME || 'MediCare')],
      ['process.env.REACT_APP_API_TIMEOUT_MS', JSON.stringify(env.REACT_APP_API_TIMEOUT_MS || '15000')],
    ])),
    server: { proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5000', '/readyz': process.env.API_PROXY_TARGET || 'http://localhost:5000' } },
    build: { outDir: 'build', sourcemap: false },
    test: { globals: true, environment: 'jsdom', setupFiles: ['./src/setupTests.js'], clearMocks: true },
  };
});

