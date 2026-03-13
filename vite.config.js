import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectId = env.VITE_SUPABASE_PROJECT_ID || 'aipjlpuintvfcjnzaqlu'
  const supabaseUrl = env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`
  const publishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcGpscHVpbnR2ZmNqbnphcWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDY5MjUsImV4cCI6MjA4ODkyMjkyNX0.ddtrL944fNVVJsiaCI1enrE5PU1TxeSGAYev9y5w78E'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '::',
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publishableKey),
    },
  }
})
