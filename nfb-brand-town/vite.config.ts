import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Netlify 가 빌드할 때 알려주는 사이트 주소(URL)를 미리보기 그림 주소에 쓴다.
process.env.VITE_SITE_URL ??= process.env.URL ?? ''

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
