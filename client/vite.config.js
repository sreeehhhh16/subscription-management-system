import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Requests to /api go to the Express server, so the client never hardcodes a port
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
