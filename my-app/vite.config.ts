import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api requests to Vercel dev server during local development.
      // Run `vercel dev` alongside `npm run dev`, or use `vercel dev --listen 3001`
      // and adjust the target port below to match.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      external: [
        /^@tauri-apps\/api/,
        /^@tauri-apps\/plugin-/
      ]
    },
    rolldownOptions: {
      external: [
        /^@tauri-apps\/api/,
        /^@tauri-apps\/plugin-/
      ]
    }
  }
})
