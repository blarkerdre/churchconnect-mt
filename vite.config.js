import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectId = env.VITE_SUPABASE_PROJECT_ID || ''
  const supabaseUrl = env.VITE_SUPABASE_URL || ''
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

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
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(projectId),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publishableKey),
    },
  }
})
