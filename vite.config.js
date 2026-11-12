import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 部署时通过 BASE_PATH 环境变量设置子路径
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5174,
    strictPort: true,
    host: true
  }
})
