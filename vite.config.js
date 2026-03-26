import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

const envDefaults = {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://qfordhikmtgedfybktjg.supabase.co'),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3JkaGlrbXRnZWRmeWJrdGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTY3ODcsImV4cCI6MjA5MDAzMjc4N30.edOKxghMZxEq9VK3VVKAa_-WTQPZkOyVT7-pJFr31ho'),
  'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify('qfordhikmtgedfybktjg'),
};

export default defineConfig({
  plugins: [react()],
  define: { ...envDefaults },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
  },
})
