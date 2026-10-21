import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // For GitHub Pages project repositories, change to '/ev-access/'.
  // For Netlify, Vercel, or a root domain, keep base as '/' or omit it.
  base: '/',
})
