import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/upload-batch': 'http://localhost:8000',
      '/run-batch': 'http://localhost:8000',
      '/summary': 'http://localhost:8000',
      '/matches': 'http://localhost:8000',
      '/exceptions': 'http://localhost:8000',
      '/forecast': 'http://localhost:8000',
      '/tax-audit': 'http://localhost:8000',
      '/ask': 'http://localhost:8000',
      '/reset-db': 'http://localhost:8000',
      '/comments': 'http://localhost:8000',
      '/submit-feedback': 'http://localhost:8000',
      '/add-comment': 'http://localhost:8000',
    }
  }
})
