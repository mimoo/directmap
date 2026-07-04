import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/directmap/',
  plugins: [react()],
  server: {
    allowedHosts: ['host.docker.internal'],
  },
})
