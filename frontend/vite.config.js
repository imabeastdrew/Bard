import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/chapters': 'http://localhost:8000',
      '/ask': 'http://localhost:8000',
      '/answers': 'http://localhost:8000',
      '/context': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/transcribe': 'http://localhost:8000',
    }
  }
})

