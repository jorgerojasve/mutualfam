import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawApiUrl = (env.VITE_API_URL || process.env.VITE_API_URL || '')
    .toString()
    .trim()
    .replace(/[\r\n\t]/g, '')
    .replace(/\/+$/, '');

  return {
    plugins: [react()],
    define: rawApiUrl ? {
      'import.meta.env.VITE_API_URL': JSON.stringify(rawApiUrl),
    } : {},
  };
});

