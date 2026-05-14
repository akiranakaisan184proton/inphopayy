import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:4000',
      '/me': 'http://localhost:4000',
      '/wallet': 'http://localhost:4000',
      '/transactions': 'http://localhost:4000',
      '/pix': 'http://localhost:4000',
    },
  },
})
