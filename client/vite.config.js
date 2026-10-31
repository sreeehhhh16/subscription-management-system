/* global process */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Only the published build uses the repo name as its address
const base = process.env.GITHUB_PAGES ? '/subscription-management-system/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
