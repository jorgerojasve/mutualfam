import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawApiUrl = (env.VITE_API_URL || process.env.VITE_API_URL || '')
    .toString()
    .trim()
    .replace(/[\r\n\t]/g, '')
    .replace(/\/+$/, '');

  let appVersion = '1.1.77';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
    if (pkg.version) appVersion = pkg.version;
  } catch (_) {}

  // Generar /version.json en public/ para dev server y Vite static copy
  try {
    const publicDir = path.resolve(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(
      path.resolve(publicDir, 'version.json'),
      JSON.stringify({ version: appVersion, buildTime: Date.now() }, null, 2)
    );
  } catch (err) {
    console.warn('Could not generate public/version.json:', err);
  }

  const versionPlugin = () => ({
    name: 'generate-dist-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: appVersion, buildTime: Date.now() }, null, 2),
      });
    },
  });

  return {
    plugins: [react(), versionPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      ...(rawApiUrl ? { 'import.meta.env.VITE_API_URL': JSON.stringify(rawApiUrl) } : {}),
    },
  };
});
