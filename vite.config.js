import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createAiProxy } from './server/aiProxy.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ai-resume-backend',
      configureServer(server) {
        server.middlewares.use(createAiProxy());
      }
    }
  ],
  server: {
    port: 5173
  }
});
