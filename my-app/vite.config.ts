import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
