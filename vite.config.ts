import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { defineConfig } from 'vite';

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return { commit, branch, hasGit: true };
  } catch {
    return { commit: '', branch: '', hasGit: false };
  }
}

function getPackageVersion() {
  try {
    const pkgPath = path.resolve(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version && pkg.version !== '0.0.0') return pkg.version;
    }
  } catch {}
  return '1.5.0';
}

export default defineConfig(() => {
  const gitInfo = getGitInfo();
  const appVersion = getPackageVersion();
  const buildTs = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Dimensio - Gestão de Escalas e Dimensionamento',
          short_name: 'Dimensio',
          description: 'Aplicativo para gestão de escalas de trabalho, presença, dimensionamento e intervalos',
          theme_color: '#4f46e5',
          background_color: '#f5f6fb',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_TS__: JSON.stringify(buildTs),
      __GIT_COMMIT__: JSON.stringify(gitInfo.commit),
      __GIT_BRANCH__: JSON.stringify(gitInfo.branch),
      __HAS_GIT__: JSON.stringify(gitInfo.hasGit),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
